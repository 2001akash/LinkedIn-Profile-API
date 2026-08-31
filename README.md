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

Local test

You can run a one-off test scrape locally with:

```bash
# set credentials in .env
npm run test-scrape -- https://www.linkedin.com/in/<profile>
```

Or set `TEST_PROFILE_URL` in your `.env` and run:

```bash
npm run test-scrape
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

- `deploy_fly.yml` deploys to Fly.io. To use it, set the `FLY_API_TOKEN` and `FLY_APP_NAME` repository secrets and `GHCR_TOKEN` for pushing images to GHCR.

Hosting options

- Render: Add `RENDER_API_KEY` and `RENDER_SERVICE_ID` as GitHub secrets to enable `deploy_render.yml`.
- Fly: Add `FLY_API_TOKEN`, `FLY_APP_NAME`, and `GHCR_TOKEN` secrets to enable `deploy_fly.yml`.

Render deployment (step-by-step)

1. Create a new Web Service on Render and connect it to this GitHub repository.
  - When Render asks for the build method, choose "Docker" and point to the repository root (the included `Dockerfile` will be used).
  - Alternatively, use the provided `render.yaml` manifest to create the service via Render's dashboard or CLI (update `repo` in the file first).
2. In the Render service dashboard, set environment variables: `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD`, and `HEADLESS`.
3. If you want GitHub Actions to push images and optionally trigger Render deploys, add these GitHub secrets: `GHCR_TOKEN`, `RENDER_API_KEY`, and `RENDER_SERVICE_ID`.
  - Create `RENDER_API_KEY` in Render account settings → API Keys.
  - `RENDER_SERVICE_ID` is available in the Render service settings or via the Render API after creating the service.
4. Push to `main` — Render will automatically build and deploy, or run the `deploy_render.yml` workflow to build/push then trigger a Render deploy.

After deployment, Render will provide a public HTTPS URL where you can `POST /scrape` as documented above.
