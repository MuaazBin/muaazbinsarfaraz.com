# MuaazBinSarfaraz.com

A responsive, accessible personal portfolio for Muaaz Bin Sarfaraz. The site is intentionally built as plain HTML, CSS, and JavaScript: no build system, no paid theme, and no framework lock-in.

## Preview it locally

Open `index.html` directly, or run a small local server from this folder:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Publish it — recommended path

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
- Decide whether to expose a phone number. This version intentionally publishes email and LinkedIn only.
- Update the CV in `assets/Muaaz-Bin-Sarfaraz-CV.pdf` whenever the résumé changes.
- Add analytics only after choosing a privacy approach. Cloudflare Web Analytics or Plausible are lightweight options.

## Editing the content

- Main page content: `index.html`
- Colors, typography, layout, and responsive behavior: `styles.css`
- Navigation, reveal animations, metric counters: `script.js`
- Downloadable résumé and favicon: `assets/`

The site uses system fonts and local assets, so it remains fast and functional without third-party requests.
