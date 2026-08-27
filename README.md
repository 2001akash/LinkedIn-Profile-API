# LinkedIn Profile API

This project provides an API that accepts a LinkedIn profile URL and returns structured JSON containing profile fields (name, headline, location, about, experience, education, skills, certifications, languages, and images) by using Playwright to load and scrape the profile pages.

Features
- POST /scrape with JSON `{ "url": "https://www.linkedin.com/in/..." }`
- Returns profile JSON with available fields (best-effort extraction)
- Uses LinkedIn credentials for authenticated access (via environment variables)
- Docker-ready for deployment

Security
- Do NOT commit your `.env` file. Use the `.env.example` as a template.

Quick start

1. Copy `.env.example` to `.env` and set `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD`.
2. Install dependencies:

```bash
npm install
npx playwright install --with-deps
```

3. Run:

```bash
npm start
```

API

- POST /scrape
  - Body: `{ "url": "<linkedin profile url>" }`
  - Response: `200 OK` JSON object containing extracted profile fields. Example keys: `name`, `headline`, `location`, `about`, `experience` (array), `education` (array), `skills` (array), `languages` (array), `images` (array).

Approach

- Use Playwright to log in to LinkedIn using provided credentials and then navigate to the target profile URL.
- Use DOM scraping (query selectors) to extract common fields. The scraper attempts multiple likely selectors for robustness and returns partial data if some fields are unavailable.

Limitations

- LinkedIn's DOM changes frequently — selectors may break and require maintenance.
- Using this scraper may violate LinkedIn's Terms of Service — run only with an account you control and understand legal/ethical constraints.
- Anti-bot measures, rate limits, or account restrictions may prevent scraping at scale.

Repository

Create a GitHub repository and push this folder. Keep your `.env` out of source control.

Push to GitHub

1. Create a new public repository on GitHub (choose a name like `linkedin-profile-api`).
2. From this project root, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/linkedin-profile-api.git
git push -u origin main
```

CI & Deployment

- This repo includes GitHub Actions workflows in `.github/workflows/ci.yml` and `.github/workflows/deploy_render.yml`.
- `ci.yml` builds a Docker image and pushes it to GitHub Container Registry (GHCR). Set the `GHCR_TOKEN` secret in your repository settings.
- `deploy_render.yml` is a manual workflow that builds and pushes the image, and can optionally trigger a Render deploy when `RENDER_API_KEY` and `RENDER_SERVICE_ID` are set as secrets.
