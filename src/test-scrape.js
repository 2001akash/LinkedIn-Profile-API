const dotenv = require('dotenv');
const { scrapeProfile } = require('./scraper');

dotenv.config();

async function run() {
  const url = process.argv[2] || process.env.TEST_PROFILE_URL;
  if (!url) {
    console.error('Usage: node src/test-scrape.js <linkedin_profile_url>');
    process.exit(2);
  }

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    console.error('Please set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in your .env');
    process.exit(2);
  }

  try {
    console.log('Starting scrape for', url);
    const profile = await scrapeProfile(url, { email, password, headless: true });
    console.log(JSON.stringify(profile, null, 2));
  } catch (err) {
    console.error('Scrape failed:', err);
    process.exit(1);
  }
}

run();
