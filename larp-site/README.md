# LARP — playblockbet universe (website only)

This directory is an **independent static website**, intended for `https://larp.playblockbet.com`. It is **not** the casino website. The existing BlockBet lives at `https://playblockbet.com` and is linked from the LARP homepage/navigation.

## Run locally

Open `larp-site/index.html` in a browser, or run a static server from inside `larp-site/`:

```sh
python3 -m http.server 8080
```

Navigate to http://localhost:8080.

## Deploy

Publish **only the contents of `larp-site/`** to static hosting (Cloudflare Pages, Netlify, GitHub Pages with a build/deploy step, etc.). In your host, set the project root / publish directory to `larp-site` and configure the custom domain **larp.playblockbet.com**. Add the DNS CNAME record indicated by your hosting provider; enable HTTPS. Do not point `playblockbet.com` at this directory. **No DNS or hosting changes are made in this PR.**

## What works

- Responsive dashboard with local roleplay character (browser-only, not server authentication)
- Twelve **fictional** bank themes with a shared demo balance and fake credit/spend controls
- Two original design wallets inspired by common mobile-wallet patterns, with twelve collectible cards; nothing is linked to Google Pay, Apple Pay, banks, NFC or payment networks
- Three fictional creator analytics studios, customizable followers/views/likes, drafts
- Simulated livestream viewer counts, fictional gifts, rule-based comments that react to typed messages or optional speech recognition (subject to browser support)
- Play-credit cases with transparent 68/25/6/1 tier probabilities, independent randomized rolls, and no real-world rewards
- Persistent local state through localStorage; no backend, API keys or accounts needed

The casino game code, routes and dice animation are **intentionally unchanged**: the user requested two sites and explicitly prioritized the LARP website first.

## Safety, privacy and future integration

Every financial display and social metric is a fictional demo; don't use this project to issue payment confirmations or impersonate real platforms. Never enter financial credentials or real card details.

Do **not** add your Ollama key to the static website. The key was disclosed in chat and should be rotated. For future AI reactions, create a server-side function with the new key in the host's environment secrets. Add request authorization, abuse limits and content filtering. Without a backend, live comments are locally generated.

Ideas for a later version: theme marketplace, home-screen widgets, custom fictional business accounts, scheduled story mode, achievement quests, photo/video scene uploads with clear simulation overlays, roleplay character wardrobes and cloud save.
