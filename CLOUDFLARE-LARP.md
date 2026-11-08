# Cloudflare LARP deployment fix

Both hostnames can use this repository without showing the same page.

- **playblockbet.com**: original casino root. Standard Vite build with `npm run build` and output `dist`.
- **larp.playblockbet.com**: separate standalone site in `larp-site/` with its own HTML, CSS and JavaScript.

## Automatic compatibility

The root Vite build also copies `larp-site/` to `dist/larp/`. If Cloudflare accidentally serves the casino build to **larp.playblockbet.com**, the root `index.html` now immediately routes that hostname to `/larp/`. The casino remains unchanged for `playblockbet.com`.

A LARP-only Cloudflare Pages project may alternatively publish `larp-site` directly with build command `exit 0`. Both arrangements now work.

## If the LARP URL still shows BlockBet

1. In Cloudflare Pages **Deployments**, verify the latest `main` deployment succeeded and uses a commit containing the hosting fix. Trigger **Retry deployment** if needed.
2. Check the LARP custom domain points to the intended Cloudflare Pages project (under **Custom domains**). If the Pages project isn't deploying recent commits, fix the GitHub integration.
3. In the casino Vite build, try `https://larp.playblockbet.com/larp/`. If this works but the root still displays casino, the root response is cached. Purge the cache for that hostname, then hard refresh.
4. If neither works, check the Pages **Build command** and **Build output directory**. To enable the compatibility build, set `npm run build` and `dist`. To deploy just the standalone site, set `exit 0` and `larp-site`.
5. When using two projects, keep `playblockbet.com` attached only to the casino Pages project, and `larp.playblockbet.com` only to the LARP Pages project.

**No GitHub commit can directly change a Cloudflare custom-domain DNS mapping.** If the domain points to a different hosting account, that mapping must be corrected in Cloudflare.
