# MuaazBinSarfaraz.com

A responsive, accessible personal portfolio for Muaaz Bin Sarfaraz. The site is intentionally built as plain HTML, CSS, and JavaScript: no build system, no paid theme, and no framework lock-in.

> **Production hosting:** The live site is deployed from GitHub to Cloudflare Pages. Start with [DEPLOYMENT-HANDOVER.md](DEPLOYMENT-HANDOVER.md) for the current repository structure, preview workflow, production deployment, Cloudflare Functions, cache handling, security rules, and rollback procedure. The older Netlify notes below are historical and must not be used for current production.

## Preview it locally

Open `index.html` directly, or run a small local server from this folder:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Historical initial-hosting notes — do not use for current production

### 1. Buy the domain

1. Search for `muaazbinsarfaraz.com` at a reputable registrar such as Cloudflare Registrar, Porkbun, or Namecheap.
2. Confirm the renewal price, not only the first-year promotional price.
3. Turn on auto-renew and two-factor authentication.
4. Keep domain privacy enabled when the registrar supports it.
5. Do not buy hosting from the registrar yet; this site can be hosted free on Netlify, Cloudflare Pages, GitHub Pages, or Vercel.

Domain availability changes constantly, so check it at the registrar immediately before purchase.

### 2. Put the code on GitHub

1. Create a GitHub account if needed.
2. Create a new public repository named `muaazbinsarfaraz.com`.
3. Upload `index.html`, `styles.css`, `script.js`, the `assets` folder, and this `README.md`.
4. Keep the same folder structure.

### 3. Deploy on Netlify

1. Sign in to Netlify with GitHub.
2. Choose **Add new site → Import an existing project**.
3. Select the GitHub repository.
4. Leave the build command empty and set the publish directory to `.`.
5. Deploy. Netlify will provide a temporary `*.netlify.app` URL.

### 4. Connect MuaazBinSarfaraz.com

1. In Netlify, open **Domain management → Add a domain**.
2. Enter `muaazbinsarfaraz.com`.
3. Netlify will show the DNS records to create.
4. In the registrar’s DNS screen, add those exact records.
5. Add `www.muaazbinsarfaraz.com` too, then redirect it to the root domain (or the reverse).
6. Wait for DNS to propagate. HTTPS should be issued automatically.

Never guess DNS values: use the exact values shown by the hosting provider at setup time.

## Before the public launch

- Replace or confirm every claim and metric.
- Confirm that the portfolio-lab examples can be shared publicly.
- Add a professional portrait only if it supports the brand; the current design does not depend on one.
- This version intentionally publishes email only. It does not expose a phone number or downloadable CV.
- Add analytics only after choosing a privacy approach. Cloudflare Web Analytics or Plausible are lightweight options.

## Editing the content

- Main page content: `index.html`
- Colors, typography, layout, and responsive behavior: `styles.css`
- Navigation, reveal animations, metric counters: `script.js`
- Shared images, generated browser assets, and favicon: `assets/`

The site uses system fonts and local assets, so it remains fast and functional without third-party requests.

## Document to Deck AI tool

The portfolio now includes `/tools/`, a one-page Document to Deck application. Cloudflare Pages serves the portfolio and tool interface as static assets. Cloudflare Pages Functions automatically deploy the files under `functions/` as server-side routes on the same domain:

- `GET /api/config` returns public integration configuration.
- `POST /api/generate-deck` validates the request, verifies Turnstile, screens untrusted document text, and calls Claude.

The original DOCX or PDF is parsed in the visitor's browser and never uploaded. Only normalized extracted text is sent to the function and then to Anthropic. The application does not persist document text or generated decks.

### Secret environment variables

Store these as **encrypted secrets** in Cloudflare Pages → your project → Settings → Variables and Secrets → Production:

- `ANTHROPIC_API_KEY` — private Claude Console API key.
- `TURNSTILE_SECRET_KEY` — private Turnstile server-validation secret.

Do not put either value in `wrangler.jsonc`, `.env.example`, browser JavaScript, GitHub Actions logs, or Cloudflare plaintext variables. For local development, copy `.env.example` to the gitignored `.dev.vars` file and place values there.

### Public environment variables

These identifiers are intentionally exposed to the browser and can be regular Cloudflare variables:

- `TURNSTILE_SITE_KEY` — public Turnstile widget site key.
- `GOOGLE_OAUTH_CLIENT_ID` — Google OAuth Web client ID used by Google Identity Services.

The remaining non-sensitive production defaults are versioned in `wrangler.jsonc`: model IDs, input limits, allowed origins, and whether Turnstile is required.

### Claude setup

1. Create a Claude Console workspace dedicated to this website.
2. Enable API billing and set a conservative monthly spend limit.
3. Create a scoped API key and store it as `ANTHROPIC_API_KEY` in Cloudflare.
4. Never reuse a personal or Claude Code credential.

### Turnstile setup

1. Create a Turnstile widget restricted to `muaazbinsarfaraz.com` and the Pages preview hostname.
2. Store its secret as `TURNSTILE_SECRET_KEY`.
3. Store its site key as the public `TURNSTILE_SITE_KEY` variable.
4. Keep `TURNSTILE_REQUIRED=true` in production.

### Google Slides setup

1. Create a Google Cloud project and enable the Google Drive API.
2. Configure an OAuth consent screen for the production domain.
   Use `https://muaazbinsarfaraz.com/privacy/` as the public privacy-policy URL.
3. Create a Web application OAuth client with the portfolio origin.
4. Add its client ID as `GOOGLE_OAUTH_CLIENT_ID` in Cloudflare.
5. Add `https://muaazbinsarfaraz.com` and the Pages preview origin to Authorized JavaScript origins.

No Google client secret is needed: the browser requests the narrow `drive.file` scope, keeps the short-lived access token in memory, uploads the generated PPTX directly to the user's Drive, and converts it to native Google Slides.

### Local development

```powershell
pnpm install
pnpm run build
pnpm exec wrangler pages dev . --binding MOCK_AI=true
```

Mock mode exercises the complete interface without Claude or Turnstile. It must never be enabled in production.

### Cloudflare Pages deployment

The existing Git-connected Pages deployment can remain in place. Commit the generated `assets/tools/` files along with `functions/`. Cloudflare detects and deploys Pages Functions alongside the static site.

- Build command: leave empty if generated browser bundles are committed, or use `pnpm run build`.
- Build output directory: `.`
- Production branch: `main`
- Functions directory: `functions/` (detected automatically)

Add production and preview variables separately in Cloudflare. Preview should use a separate Anthropic API key and Turnstile widget where possible.

### Security model

- DOCX and PDF files are parsed in a browser worker with size, page, text, and timeout ceilings.
- Legacy DOC, macro-enabled formats, encrypted files, and scanned PDFs are not supported.
- Extracted text is normalized and JSON-encoded as untrusted data.
- Claude receives no tools, file access, browser, shell, or network capabilities.
- A separate lightweight model screens for indirect prompt injection.
- Claude Opus must return a constrained JSON deck schema.
- Server and browser validation strip unknown properties, executable markup, unsafe control characters, and excessive content.
- HTML and PowerPoint exporters use fixed application templates; the model cannot generate code.
- Turnstile, origin checks, a Cloudflare `RATE_LIMITER` binding (10 generation attempts per minute per key), and request ceilings protect the public endpoint.
- Operational logs must never include document text, generated content, API keys, Turnstile tokens, or Google access tokens.
