# MiGym Pro — Deployment Guide

## What's in this folder

- `index.html` — the full app (Parts 1+2+3 merged)
- `privacy-policy.html` — required for Play Store
- `_redirects` — Netlify SPA routing (do not rename)
- `netlify.toml` — security headers + caching
- `manifest.json` — PWA manifest (needed for Play)
- `robots.txt` — SEO
- `.well-known/assetlinks.json` — Play Store app-link verification (fill after PWABuilder)
- `logo.png` — your 512×512 PNG

## Deploy to Netlify (5 minutes)

1. **Update the privacy URL** in `index.html`. Search for:
   ```javascript
   const PRIVACY_URL = 'https://your-domain.netlify.app/privacy-policy.html';