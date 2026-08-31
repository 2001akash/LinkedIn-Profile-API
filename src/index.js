const express = require('express');
const dotenv = require('dotenv');
const pino = require('pino');
const bodyParser = require('express').json;
const { scrapeProfile } = require('./scraper');
const { scrapeProfileApi } = require('./api_scraper');

dotenv.config();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.use(bodyParser());

app.get('/', (req, res) => res.send({status: 'ok'}));

app.post('/scrape', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).send({ error: 'Missing url in body' });
  try {
    logger.info({ url }, 'Starting scrape');
    let result;
    if ((process.env.USE_API || 'false') === 'true') {
      result = await scrapeProfileApi(url, {
        li_at: process.env.LI_AT,
        jsessionid: process.env.JSESSIONID
      });
    } else {
      result = await scrapeProfile(url, {
        email: process.env.LINKEDIN_EMAIL,
        password: process.env.LINKEDIN_PASSWORD,
        headless: (process.env.HEADLESS || 'true') === 'true'
      });
    }
    res.json({ ok: true, url, profile: result });
  } catch (err) {
    logger.error(err, 'Scrape failed');
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info({ port }, 'Server listening');
});
