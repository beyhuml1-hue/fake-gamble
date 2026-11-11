/**
 * Isolated BlockBet email sign-in Worker.
 * Attach the Cloudflare Route: playblockbet.com/api/auth/*
 * All other paths continue to the existing fake-gamble Worker.
 * Reuses the same handlers as Pages Functions, preserving one source of truth.
 */
import { onRequestPost as requestCode } from "./functions/api/auth/request.js";
import { onRequestPost as signup } from "./functions/api/auth/signup.js";
import { onRequestPost as login } from "./functions/api/auth/login.js";
import { onRequestPost as verifyCode } from "./functions/api/auth/verify.js";
import { onRequestGet as sessionInfo } from "./functions/api/auth/me.js";
import { onRequestPost as logout } from "./functions/api/auth/logout.js";
import { onRequestGet as status } from "./functions/api/auth/status.js";
import { onRequestGet as liveBets, onRequestPost as postLiveBet } from "./functions/api/auth/live-bets.js";

import { onRequestGet as getAccount, onRequestPost as updateAccount } from "./functions/api/auth/admin.js";

import { onRequestGet as community, onRequestPost as postCommunity } from "./functions/api/auth/community.js";
import { onRequestGet as minesBattles, onRequestPost as postMinesBattle } from "./functions/api/auth/mines-battles.js";
import { onRequestGet as aiOwner, onRequestPost as postAiOwner } from "./functions/api/auth/ai-owner.js";

const routes = {
  "GET /api/auth/ai-owner": aiOwner,
  "POST /api/auth/ai-owner": postAiOwner,
  "GET /api/auth/mines-battles": minesBattles,
  "POST /api/auth/mines-battles": postMinesBattle,
  "GET /api/auth/community": community,
  "POST /api/auth/community": postCommunity,
  "GET /api/auth/admin": getAccount,
  "POST /api/auth/admin": updateAccount,
  "POST /api/auth/request": requestCode,
  "POST /api/auth/signup": signup,
  "POST /api/auth/login": login,
  "POST /api/auth/verify": verifyCode,
  "GET /api/auth/me": sessionInfo,
  "POST /api/auth/logout": logout,
  "GET /api/auth/status": status,
  "GET /api/auth/live-bets": liveBets,
  "POST /api/auth/live-bets": postLiveBet,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const handler = routes[method + " " + url.pathname];
    if (!handler) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    try {
      return await handler({ request, env, ctx });
    } catch {
      return new Response(JSON.stringify({ error: "Authentication temporarily unavailable." }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
  },
};
