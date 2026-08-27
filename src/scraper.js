const playwright = require('playwright');

async function ensureLoggedIn(page, email, password) {
  if (!email || !password) throw new Error('LINKEDIN_EMAIL and LINKEDIN_PASSWORD required');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });
  await page.fill('input#username', email);
  await page.fill('input#password', password);
  await Promise.all([
    page.click('button[type=submit]'),
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
  ]);
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
  const browser = await playwright.chromium.launch({ headless: opts.headless !== false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login if credentials provided
    if (opts.email && opts.password) {
      await ensureLoggedIn(page, opts.email, opts.password);
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
    await browser.close();
    throw err;
  }
}

module.exports = { scrapeProfile };
