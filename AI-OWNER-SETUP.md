# PlayBlockBet AI Owner — sandbox staging

This stage implements a server-side NanoGPT tool-calling gateway, private per-user D1 conversation history, read-only verified demo bet stats, and a separate imaginary-player coin ledger with owner-only rewards. It does not alter the live wallet or any real-money funds.

The right-side live chat drawer opens and closes on every site page, retains the seven-minute Rain, and supports @ai plus player mention autocomplete. @ai answers are private to the requesting player.

Set a newly rotated NanoGPT key as the Cloudflare Worker secret NANOGPT_API_KEY, plus NANOGPT_MODEL and ADMIN_EMAIL. The default requested model is Qwen3.7 Flash; verify its exact provider model identifier. See .env.example.

Deploy only to an independent test Worker and D1 database first. Run all migrations, including 0008_ai_owner_sandbox.sql. Tests mock the NanoGPT HTTP response; they do not verify the external provider.

Not implemented or enabled in this stage: Discord bot, autonomous giveaways, scheduled reports, loyalty bonuses, and live balance adjustments. Existing game wallets are browser-local and are not authoritative server balances. The production Worker is intentionally unchanged until separate test deployment and verification.

A key pasted into chat should be revoked and replaced before use.
