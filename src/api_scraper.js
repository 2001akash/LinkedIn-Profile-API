const { URL } = require('url');

function extractPublicIdentifier(profileUrl) {
  try {
    const u = new URL(profileUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    // common forms: /in/<id>/ or /pub/.../<id>
    if (parts[0] === 'in' && parts[1]) return parts[1];
    // fallback to last segment
    return parts[parts.length - 1] || null;
  } catch (e) {
    return null;
  }
}

async function fetchJsonApi(publicId, opts) {
  const url = `https://www.linkedin.com/voyager/api/identity/profiles/${encodeURIComponent(publicId)}/profileView`;
  const li_at = process.env.LI_AT || opts.li_at || '';
  const jsession = process.env.JSESSIONID || opts.jsessionid || '';

  const headers = {
    Accept: 'application/json',
    'x-restli-protocol-version': '2.0.0',
    'User-Agent': opts.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Referer: `https://www.linkedin.com/in/${publicId}/`,
  };

  const cookieParts = [];
  if (li_at) cookieParts.push(`li_at=${li_at.replace(/(^"|"$)/g, '')}`);
  if (jsession) cookieParts.push(`JSESSIONID=${jsession.replace(/(^"|"$)/g, '')}`);
  if (cookieParts.length) headers.Cookie = cookieParts.join('; ');
  if (jsession) headers['csrf-token'] = jsession.replace(/(^"|"$)/g, '');

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LinkedIn API request failed: ${res.status} ${res.statusText} ${text.slice(0,200)}`);
  }
  return res.json();
}

function mapApiToProfile(apiJson) {
  if (!apiJson || typeof apiJson !== 'object') return {};
  const profile = {};
  const root = apiJson && apiJson.profileView && apiJson.profileView.profile ? apiJson.profileView.profile : apiJson;
  // Best-effort mapping
  profile.name = (root.firstName && root.lastName) ? `${root.firstName} ${root.lastName}` : root.fullName || null;
  profile.headline = root.headline || root.occupation || null;
  profile.location = root.locationName || null;
  profile.about = root.summary || null;
  profile.experience = (root.positions || []).map(p => ({
    title: p.title || p.companyPositionTitle || null,
    company: p.companyName || (p.company && p.company.name) || null,
    startDate: p.timePeriod && p.timePeriod.startDate ? p.timePeriod.startDate : null,
    endDate: p.timePeriod && p.timePeriod.endDate ? p.timePeriod.endDate : null,
    description: p.description || null
  }));
  profile.education = (root.educations || []).map(e => ({
    school: e.schoolName || null,
    degree: e.degreeName || null,
    fieldOfStudy: e.fieldOfStudy || null,
    startDate: e.timePeriod && e.timePeriod.startDate ? e.timePeriod.startDate : null,
    endDate: e.timePeriod && e.timePeriod.endDate ? e.timePeriod.endDate : null
  }));
  profile.skills = (root.skills || []).map(s => s.name || s) || [];
  profile.languages = (root.languages || []).map(l => l.name || l) || [];
  profile.images = [];
  if (root.profilePicture && root.profilePicture['displayImage~'] && root.profilePicture['displayImage~'].elements) {
    profile.images = root.profilePicture['displayImage~'].elements.flatMap(e => e.identifiers ? e.identifiers.map(id => id.identifier) : []).filter(Boolean);
  }
  return profile;
}

async function fetchHtmlFallback(url, opts) {
  const headers = {
    'User-Agent': opts.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'text/html'
  };
  const li_at = process.env.LI_AT || opts.li_at || '';
  const jsession = process.env.JSESSIONID || opts.jsessionid || '';
  const cookieParts = [];
  if (li_at) cookieParts.push(`li_at=${li_at.replace(/(^"|"$)/g, '')}`);
  if (jsession) cookieParts.push(`JSESSIONID=${jsession.replace(/(^"|"$)/g, '')}`);
  if (cookieParts.length) headers.Cookie = cookieParts.join('; ');

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTML fetch failed: ${res.status}`);
  const html = await res.text();
  // Attempt to extract JSON-LD
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      return { ld };
    } catch (e) {}
  }
  // Attempt to find initial state JSON
  const initMatch = html.match(/window\.__INITIAL_STATE__ = (\{[\s\S]*?\});/i) || html.match(/<code id="bpr-guid-[^"]+">([\s\S]*?)<\/code>/i);
  if (initMatch) {
    try {
      const obj = JSON.parse(initMatch[1]);
      return { init: obj };
    } catch (e) {}
  }
  return { html };
}

async function scrapeProfileApi(url, opts = {}) {
  const publicId = extractPublicIdentifier(url);
  if (!publicId) throw new Error('Could not extract profile identifier from URL');
  try {
    const apiJson = await fetchJsonApi(publicId, opts);
    const mapped = mapApiToProfile(apiJson);
    return mapped;
  } catch (err) {
    // fallback to HTML parse
    const fh = await fetchHtmlFallback(url, opts);
    if (fh.ld) {
      const ld = fh.ld;
      return {
        name: ld.name || null,
        headline: ld.jobTitle || null,
        about: ld.description || null,
        images: ld.image ? (Array.isArray(ld.image) ? ld.image : [ld.image]) : []
      };
    }
    if (fh.init) {
      // best-effort traverse
      const obj = fh.init;
      // attempt to find profile in initial state
      const profiles = JSON.stringify(obj);
      const nameMatch = profiles.match(/"fullName"\s*:\s*"([^"]+)"/);
      return { name: nameMatch ? nameMatch[1] : null };
    }
    throw err;
  }
}

module.exports = { scrapeProfileApi };
