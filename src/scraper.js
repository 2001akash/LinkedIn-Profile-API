const playwright = require('playwright');
const fs = require('fs');

async function ensureLoggedIn(page, email, password) {
  if (!email || !password) throw new Error('LINKEDIN_EMAIL and LINKEDIN_PASSWORD required');
  // Navigate and wait for the login form to appear
  await page.goto('https://www.linkedin.com/login', { timeout: 60000 }).catch(() => {});
  // Wait for either email or username autocomplete input
  await page.waitForSelector('input[autocomplete="username"], input[type="email"], input[autocomplete="username webauthn"]', { timeout: 60000 });
  const emailSelector = 'input[autocomplete="username"], input[type="email"], input[autocomplete="username webauthn"]';
  const passwordSelector = 'input[autocomplete="current-password"], input[type="password"]';
  await page.fill(emailSelector, email).catch(async () => {
    // fallback: try any input[type=email]
    const el = await page.$('input[type="email"]');
    if (el) await el.fill(email);
  });
  await page.fill(passwordSelector, password).catch(async () => {
    const el = await page.$('input[type="password"]');
    if (el) await el.fill(password);
  });

  // Click the sign-in button (matching visible text)
  try {
    await Promise.all([
      page.click('button:has-text("Sign in")'),
      page.waitForNavigation({ timeout: 60000 }).catch(() => {})
    ]);
  } catch (e) {
    // fallback to submit input/button
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ timeout: 60000 }).catch(() => {})
    ]).catch(() => {});
  }
}
function firstText(el, selectors) {
  for (const s of selectors) {
    const node = el.querySelector(s);
    if (node && node.textContent && node.textContent.trim()) return node.textContent.trim();
  }
  return null;
}

function mapList(root, listSelector, itemMapper) {
  const container = root.querySelector(listSelector);
  if (!container) return [];
  const items = Array.from(container.querySelectorAll('li'));
  return items.map(itemMapper).filter(Boolean);
}

async function scrapeProfile(url, opts = {}) {
  const browser = await playwright.chromium.launch({
    headless: opts.headless !== false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  const context = await browser.newContext({
    userAgent: opts.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' }
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.setDefaultTimeout(60000);

  // Basic stealth evasions
  await page.addInitScript(() => {
    // navigator webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // plugins
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    // chrome runtime
    window.chrome = window.chrome || { runtime: {} };
  });

  try {
    // If a session cookie is provided (env or opts), set it and skip login
    const envCookie = process.env.LINKEDIN_SESSION_COOKIE || process.env.LI_AT || opts.sessionCookie;
    if (envCookie) {
      // envCookie may be like 'li_at=VALUE' or just the VALUE
      const raw = envCookie.includes('=') ? envCookie.split('=')[1] : envCookie;
      // Add the cookie for several possible LinkedIn domains so it matches during navigation
      const domains = ['.www.linkedin.com', 'www.linkedin.com', '.linkedin.com', 'linkedin.com'];
      const cookies = domains.map(d => ({
        name: 'li_at',
        value: raw,
        domain: d,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      }));
      await context.addCookies(cookies).catch(async () => {
        // fallback: try adding single cookie for .linkedin.com
        await context.addCookies([{
          name: 'li_at',
          value: raw,
          domain: '.linkedin.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax'
        }]).catch(() => {});
      });
    } else {
      // Login if credentials provided
      if (opts.email && opts.password) {
        await ensureLoggedIn(page, opts.email, opts.password);
      }
    }

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const profile = await page.evaluate(() => {
      const root = document;
      const name = (root.querySelector('h1') && root.querySelector('h1').innerText.trim()) || null;
      const headline = (root.querySelector('.text-body-medium') && root.querySelector('.text-body-medium').innerText.trim()) || (root.querySelector('.pv-top-card--list li') && root.querySelector('.pv-top-card--list li').innerText.trim()) || null;
      const location = (root.querySelector('.pv-top-card--list-bullet') && root.querySelector('.pv-top-card--list-bullet').innerText.trim()) || null;
      const about = (root.querySelector('#about') && root.querySelector('#about').innerText.trim()) || (root.querySelector('[data-section="summary"]') && root.querySelector('[data-section="summary"]').innerText.trim()) || null;

      const images = [];
      const imgEl = root.querySelector('img.pv-top-card-profile-picture__image');
      if (imgEl && imgEl.src) images.push(imgEl.src);
      const heroImg = root.querySelector('.profile-photo-edit__preview');
      if (heroImg && heroImg.src) images.push(heroImg.src);

      function scrapeList(sectionLabel) {
        const sec = Array.from(root.querySelectorAll('section')).find(s => (s.innerText || '').toLowerCase().includes(sectionLabel));
        if (!sec) return [];
        const items = Array.from(sec.querySelectorAll('li'));
        return items.map(li => {
          return {
            title: li.querySelector('h3') ? li.querySelector('h3').innerText.trim() : (li.querySelector('span') ? li.querySelector('span').innerText.trim() : null),
            subtitle: li.querySelector('p') ? li.querySelector('p').innerText.trim() : null,
            meta: Array.from(li.querySelectorAll('span')).map(s => s.innerText.trim()).filter(Boolean)
          };
        }).filter(Boolean);
      }

      const experience = scrapeList('experience');
      const education = scrapeList('education');
      const certifications = scrapeList('certification');
      const languages = scrapeList('languages');

      // Skills often in a dedicated card
      const skills = Array.from(document.querySelectorAll('.pv-skill-category-entity__name-text, .skill-pill')).map(s => s.innerText.trim()).filter(Boolean);

      return { name, headline, location, about, experience, education, certifications, languages, skills, images };
    });

    await browser.close();
    return profile;
  } catch (err) {
    try {
      const now = Date.now();
      const img = `debug-${now}.png`;
      const htmlf = `debug-${now}.html`;
      await page.screenshot({ path: img, fullPage: true }).catch(() => {});
      const html = await page.content().catch(() => null);
      if (html) fs.writeFileSync(htmlf, html);
    } catch (ex) {
      // ignore
    }
    await browser.close();
    throw err;
  }
}

module.exports = { scrapeProfile };
