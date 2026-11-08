/* LARP website — all data and features are fictional and local to this browser. */
"use strict";

const BANKS = [
  ["PulseBank", "◉", "#9873fa", "Modern everyday money"],
  ["Mintline", "✳", "#35ceb4", "Fresh digital finance"],
  ["Nova Finance", "✦", "#ff9d79", "For big dreamers"],
  ["EmberCash", "✺", "#eda657", "Your bright money hub"],
  ["Quartz", "◇", "#93b6df", "The premium edit"],
  ["Orbit Money", "◎", "#799ef5", "Money in motion"],
  ["Velour", "✧", "#d5a4da", "A little luxury"],
  ["Zenith", "▲", "#95ca91", "Aiming higher"],
  ["Bankora", "▰", "#eac57f", "Everyday simplified"],
  ["Bloom", "❀", "#f2a5bd", "Room to grow"],
  ["Prism Pay", "⬡", "#95cadf", "Colourful and connected"],
  ["Saturn", "◌", "#b3a0fa", "Finance from another world"]
];
const CARDS = [
  ["Midnight Black", "midnight", "Black edition"],
  ["Titanium Silver", "silver", "Brushed metal"],
  ["Arctic Platinum", "platinum", "Ice finish"],
  ["Rose Gold", "rosegold", "Rose metal"],
  ["Aurora", "aurora", "Northern lights"],
  ["Cobalt Blue", "cobalt", "Deep blue"],
  ["Ruby Red", "ruby", "Bold red"],
  ["Emerald", "emerald", "Jade green"],
  ["Holographic", "holo", "Spectrum finish"],
  ["Carbon Fibre", "carbon", "Stealth black"],
  ["Pearl White", "pearl", "Satin white"],
  ["Sunset", "sunset", "Golden hour"]
];
const PLATFORMS = {
  viewtube: { name: "ViewTube Studio", symbol: "▶", color: "#f87183", label: "Video creator" },
  pixora: { name: "Pixora Insights", symbol: "▧", color: "#ba84fa", label: "Photo creator" },
  looptok: { name: "LoopTok Studio", symbol: "♪", color: "#5adddb", label: "Short-video creator" }
};
const CASES = [
  { name: "Street Drop", cost: 500, label: "THE STARTER EDITION", color: "violet" },
  { name: "Neon Vault", cost: 1500, label: "THE GLOW EDITION", color: "cyan" },
  { name: "Royal Cache", cost: 5000, label: "THE PRESTIGE EDITION", color: "gold" }
];
const TIERS = [
  { name: "Common", odds: 68, multiplier: 0.2, icon: "◆", className: "common" },
  { name: "Uncommon", odds: 25, multiplier: 0.8, icon: "◈", className: "uncommon" },
  { name: "Rare", odds: 6, multiplier: 2.5, icon: "✧", className: "rare" },
  { name: "Legendary", odds: 1, multiplier: 12, icon: "✦", className: "legendary" }
];
const CHAT_NAMES = ["nova77", "jazzy", "milo.w", "skyplays", "the_real_max", "minty", "halcyon", "ash.mp4", "starry", "itsquinn", "pxl_", "breezy"];
const CHAT_LINES = ["Chat is going crazy 🔥", "Anyone watching from the UK?", "Let's goooo", "That was clean", "I just joined!", "Big W", "We love to see it", "This stream is a vibe", "The energy is amazing", "What's up everyone", "Keep it up!", "First time here 👋"];
const ROUTES = { home: "Overview", banks: "Virtual Banks", "google-wallet": "Google Pay-style", "apple-wallet": "Apple Pay-style", social: "Creator Studio", live: "Simulated Live", cases: "Case Drops" };
const INITIAL = {
  profile: "", balance: 1500000, bank: 0, activity: [],
  cards: [0, 1], activeCard: 0, socialPlatform: "viewtube",
  social: { viewtube: [24580, 380420, 45600], pixora: [18450, 194200, 36120], looptok: [76500, 1430520, 284200] },
  posts: [], live: false, viewers: 2431, likes: 13600, gifts: 0, comments: [], caseHistory: [], latestDrop: null
};
function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem("larp.playblockbet.state.v1") || "null");
    return parsed && typeof parsed === "object" ? { ...structuredClone(INITIAL), ...parsed } : structuredClone(INITIAL);
  } catch { return structuredClone(INITIAL); }
}
let state = readState();
let liveTicker = null;
let toastTimeout = null;
const $ = (selector) => document.querySelector(selector);
const htmlEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const usd = (cents) => (Math.max(0, Number(cents) || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const number = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");
const tag = (small = false) => '<span class="simulation-tag' + (small ? ' small' : '') + '"><span class="status-dot"></span> ROLEPLAY SIMULATION</span>';
function persist() { try { localStorage.setItem("larp.playblockbet.state.v1", JSON.stringify(state)); } catch { /* browser may disable storage */ } }
function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => node.classList.remove("visible"), 3300);
}
function route() {
  const routeName = location.hash.replace(/^#/, "");
  return ROUTES[routeName] ? routeName : "home";
}
function pageTitle(eyebrow, title, subtitle) {
  return '<div class="page-heading"><div><div class="eyebrow">' + htmlEscape(eyebrow) + '</div><h1>' + htmlEscape(title) + '</h1><p>' + htmlEscape(subtitle) + '</p></div>' + tag() + '</div>';
}
function updateChrome() {
  const name = state.profile || "Guest";
  $("#side-avatar").textContent = name.slice(0, 1).toUpperCase();
  $("#header-avatar").textContent = name.slice(0, 1).toUpperCase();
  $("#side-name").textContent = name;
  $("#header-name").textContent = state.profile || "Sign in";
  $("#header-balance").textContent = usd(state.balance);
  $("#page-crumb").textContent = ROUTES[route()];
  document.querySelectorAll("[data-route]").forEach((item) => {
    const active = item.dataset.route === route();
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
}
function render() {
  document.body.dataset.screen = route();
  updateChrome();
  const page = route();
  const views = { home: homePage, banks: banksPage, "google-wallet": () => walletPage("google"), "apple-wallet": () => walletPage("apple"), social: socialPage, live: livePage, cases: casesPage };
  $("#screen").innerHTML = views[page]();
  if (page === "live") scrollChat();
}
function homePage() {
  const apps = [
    ["bank", "▤", "Banks", "12 banks", "#banks", ""],
    ["walletg", "◈", "G Wallet", "Cards & passes", "#google-wallet", ""],
    ["walleta", "◉", "A Wallet", "Luxury cards", "#apple-wallet", ""],
    ["video", "▶", "ViewTube", "Studio", "#social", "viewtube"],
    ["photos", "◎", "Pixora", "Insights", "#social", "pixora"],
    ["shorts", "♪", "LoopTok", "Followers", "#social", "looptok"],
    ["stream", "●", "Go Live", "Simulated fans", "#live", ""],
    ["cases", "▣", "Case Drops", "Collectibles", "#cases", ""],
    ["blockbet", "◆", "BlockBet", "Play originals", "https://playblockbet.com", ""]
  ];
  const today = new Date().toLocaleDateString("en-GB", {weekday: "long", month: "long", day: "numeric"});
  return '<section class="phone-launcher"><div class="launcher-wallpaper"><div class="launcher-glow a"></div><div class="launcher-glow b"></div></div>' +
    '<div class="launcher-head"><span class="launcher-date">' + htmlEscape(today) + '</span><span class="launcher-demo">● ROLEPLAY MODE</span>' +
    '<h1>Your other<br><em>life.</em></h1><p>Everything you wish you had. A world that is entirely yours to play with.</p></div>' +
    '<div class="launcher-widgets"><button type="button" class="balance-widget" data-action="launch-bank"><small>MY FICTIONAL BALANCE <span>↗</span></small><strong>' + usd(state.balance) + '</strong><span>◈ Across 12 demo banks</span></button>' +
    '<button type="button" class="fame-widget" data-action="launch-social" data-id="looptok"><span>◉ CREATOR PROFILE</span><strong>' + number(state.social.looptok[0]) + '</strong><small>simulated followers ↗</small></button></div>' +
    '<div class="launcher-apps-heading"><h2>My apps</h2><span>Tap any app to open full screen</span></div>' +
    '<div class="launcher-app-grid">' + apps.map((app) =>
      '<a class="launcher-app" href="' + app[4] + '"' +
      (app[5] ? ' data-action="launch-social" data-id="' + app[5] + '"' : '') +
      (app[0] === "blockbet" ? ' target="_blank" rel="noopener noreferrer"' : '') +
      '><span class="launcher-app-icon ' + app[0] + '">' + app[1] + '</span><strong>' + app[2] + '</strong><small>' + app[3] + '</small></a>'
    ).join("") + '</div>' +
    '<div class="launcher-bottom"><button type="button" data-action="fullscreen" class="launch-fullscreen">⛶ Enter full screen</button><button type="button" data-action="profile" class="launcher-character">✦ ' + htmlEscape(state.profile || "Choose a character") + ' <span>✎</span></button></div>' +
    '<p class="launcher-disclaimer">LARP is a fictional simulator. No real banks, payments, followers, broadcasts or prizes.</p></section>';
}
function banksPage() {
  const idx = Math.max(0, Math.min(BANKS.length - 1, Number(state.bank) || 0));
  const bank = BANKS[idx];
  const history = Array.isArray(state.activity) && state.activity.length ? state.activity : [
    ["Coffee & croissant (example)", -1250, "Sample transaction"],
    ["Demo funds (example)", 70000, "Sample transaction"],
    ["Monthly subscription (example)", -999, "Sample transaction"]
  ];
  return '<div class="immersive-bank" style="--selected-bank:' + bank[2] + '"><div class="bank-app-top"><div class="bank-app-brand"><span class="bank-app-logo" style="background:' + bank[2] + '">' + bank[1] + '</span><span><strong>' + bank[0] + '</strong><small>FICTIONAL BANK • SIMULATION</small></span></div><span class="bank-circle-profile">' + htmlEscape((state.profile || "G").slice(0,1).toUpperCase()) + '</span></div>' +
    '<div class="bank-app-balance"><span>YOUR TOTAL BALANCE</span><h1>' + usd(state.balance) + '</h1><p>Available in your pretend account</p></div>' +
    '<div class="bank-app-actions"><button type="button" data-action="credit"><b>＋</b><span>Add money</span></button><button type="button" data-action="spend"><b>↗</b><span>Send money</span></button><button type="button" data-action="demo-tap"><b>◈</b><span>My card</span></button><a href="#google-wallet"><b>▤</b><span>Wallet</span></a></div>' +
    '<div class="bank-app-body"><div class="bank-app-left"><div class="bank-hero-card"><div><span class="mini-bank-heading">EVERYDAY ACCOUNT</span><h2>' + bank[0] + '</h2></div><div class="bank-card-number">•••• &nbsp; •••• &nbsp; 0000</div><div class="card-watermark">LARP · DEMO</div></div>' +
    '<div class="bank-transactions"><div class="bank-section-head"><h2>Transactions</h2><span>SIMULATED HISTORY</span></div>' +
    history.slice(0,8).map((item) => '<div class="bank-transaction"><span class="txn-avatar">' + (item[1] < 0 ? "↗" : "↙") + '</span><span class="txn-detail"><b>' + htmlEscape(item[0]) + '</b><small>' + htmlEscape(item[2]) + '</small></span><strong class="' + (item[1] < 0 ? 'negative' : 'positive') + '">' + (item[1] > 0 ? "+" : item[1] < 0 ? "−" : "") + usd(Math.abs(item[1])) + '</strong></div>').join('') + '</div></div>' +
    '<div class="bank-app-right"><div class="bank-section-head"><h2>Switch bank</h2><span>12 OPTIONS</span></div><div class="bank-app-list">' +
    BANKS.map((b,i) => '<button type="button" class="bank-app-choice ' + (idx===i ? 'selected' : '') + '" data-action="pick-bank" data-id="' + i + '"><span class="bank-choice-mark" style="background:' + b[2] + '">' + b[1] + '</span><span><strong>' + b[0] + '</strong><small>' + b[3] + '</small></span><span>' + (idx===i?'✓':'›') + '</span></button>').join('') +
    '</div><div class="bank-demo-foot">This is not an actual financial institution. No bank details or transfers are real.</div></div></div></div>';
}
function cardMarkup(index, compact = false) {
  const card = CARDS[index] || CARDS[0];
  return '<div class="bank-card ' + card[1] + (compact ? ' compact' : '') + '"><div class="card-top"><span>LARP<span class="card-brand-dot">.</span></span><span class="card-demo">DEMO</span></div><div class="chip-icon"><span></span></div><div class="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 0000</div><div class="card-footer"><span>' + card[0].toUpperCase() + '</span><b>◈</b></div></div>';
}
function walletPage(mode) {
  const isApple = mode === "apple";
  const title = isApple ? "Orchard Wallet" : "Droid Wallet";
  const available = (Array.isArray(state.cards) ? state.cards : [0]).filter((index) => Number.isInteger(index) && index >= 0 && index < CARDS.length);
  const chosen = available.includes(state.activeCard) ? state.activeCard : (available[0] === undefined ? 0 : available[0]);
  return '<div class="immersive-wallet ' + (isApple ? 'wallet-orchard' : 'wallet-droid') + '"><header class="wallet-app-top"><div><small>YOUR COLLECTION</small><h1>' + title + '</h1></div><button type="button" data-action="show-cards" class="wallet-add-button" aria-label="Add virtual card">＋</button></header>' +
    '<div class="wallet-app-showcase"><div class="wallet-app-label"><span>MY CARDS</span><span>● DEMO CARD</span></div><div class="wallet-large-card">' + cardMarkup(chosen) + '</div><p>•••• 0000 &nbsp; · &nbsp; Fictional card</p><div class="wallet-app-actions"><button type="button" data-action="demo-tap">◎ Simulate payment</button><button type="button" data-action="show-cards">＋ Add a card</button></div></div>' +
    '<div class="wallet-card-shelf"><div class="bank-section-head"><h2>My collection</h2><span>' + available.length + ' STYLES SAVED</span></div><div class="wallet-mini-grid">' +
    (available.length ? available.map((idx) => '<button type="button" data-action="select-card" data-id="' + idx + '" class="wallet-mini-choice ' + (chosen===idx?'selected':'') + '">' + cardMarkup(idx, true) + '<strong>' + CARDS[idx][0] + '</strong><small>' + CARDS[idx][2] + '</small></button>').join('') : '<p>Add a collectible to start your collection.</p>') +
    '</div><button type="button" class="wallet-remove" data-action="remove-card">Remove selected card</button></div>' +
    '<div class="card-catalog" id="card-catalog" hidden><div class="bank-section-head"><h2>Card design store</h2><span>ALL FREE · SIMULATION</span></div><div class="catalog-grid">' + CARDS.map((c,i) => '<button type="button" data-action="add-card" data-id="' + i + '">' + cardMarkup(i,true) + '<strong>' + c[0] + '</strong><small>' + (available.includes(i) ? 'Select card' : 'Collect free') + '</small></button>').join('') + '</div></div><p class="wallet-risk-note">All designs are fictional; they are not payment cards and cannot be used for purchases.</p></div>';
}
function socialPage() {
  const p = PLATFORMS[state.socialPlatform] ? state.socialPlatform : "viewtube";
  const platform = PLATFORMS[p];
  const stat = Array.isArray(state.social[p]) ? state.social[p] : [0, 0, 0];
  const bars = [25, 37, 31, 49, 45, 69, 61, 83, 70, 94, 82, 99];
  return pageTitle("CREATOR UNIVERSE", "Your creator studio.", "Three original creator dashboards. Build a fictional audience without connecting or impersonating real social networks.") +
    '<div class="social-tabs">' + Object.entries(PLATFORMS).map(([key, entry]) => '<button type="button" data-action="platform" data-id="' + key + '" class="' + (key === p ? "active" : "") + '"><span style="color:' + entry.color + '">' + entry.symbol + '</span>' + entry.label + '</button>').join("") + '</div>' +
    '<div class="studio-layout"><section class="panel studio-main"><div class="studio-brand"><span style="background:' + platform.color + '">' + platform.symbol + '</span><div><small>CREATOR DASHBOARD / SIMULATED</small><h2>' + platform.name + '</h2></div><span class="mini-tag">DEMO</span></div><div class="stats-grid"><div><small>Followers</small><strong>' + number(stat[0]) + '</strong><span>↗ Fictional audience</span></div><div><small>Total views</small><strong>' + number(stat[1]) + '</strong><span>↗ Sample reach</span></div><div><small>Likes</small><strong>' + number(stat[2]) + '</strong><span>↗ Pretend engagement</span></div></div><div class="analytics"><div class="panel-title"><div><h3>Audience growth</h3><p>Illustrative activity over 12 days</p></div><span>EXAMPLE DATA</span></div><div class="chart-bars">' + bars.map((height, i) => '<div class="bar-column"><div class="bar" style="height:' + height + '%;background:' + platform.color + '"></div><small>' + (i + 1) + '</small></div>').join("") + '</div></div></section>' +
    '<aside class="panel studio-tools"><div class="creator-photo">✦</div><h2>@larp.creator</h2><p>Your fictional creator career</p><span class="creator-badge">✧ Creator mode</span><h3>Grow your audience</h3><p>Adjust demo analytics using these buttons.</p><button type="button" data-action="grow" data-index="0" data-increment="1000">＋ 1,000 followers</button><button type="button" data-action="grow" data-index="1" data-increment="10000">↗ 10,000 views</button><button type="button" data-action="grow" data-index="2" data-increment="500">♡ 500 likes</button><a class="primary-button full" href="#live">Start a pretend live →</a></aside></div>' +
    '<section class="panel content-planner"><div class="panel-title"><div><h2>Content planner</h2><p>Draft pretend uploads that never get published anywhere.</p></div><span>LOCAL ONLY</span></div><form id="post-form" class="post-form"><input name="title" maxlength="80" autocomplete="off" placeholder="Name your next fictional upload" required aria-label="Draft title"><button class="primary-button" type="submit">Make demo post</button></form>' + (Array.isArray(state.posts) ? state.posts.slice(0, 5).map((post) => '<div class="draft-row"><span>▧</span><strong>' + htmlEscape(post) + '</strong><small>Draft only</small></div>').join("") : "") + '</section>';
}
function reactTo(text) {
  const msg = String(text).toLowerCase();
  if (/\b(hello|hey|hi|welcome|what.s up)\b/.test(msg)) return ["Hiiii streamer 👋", "Heyyy!", "Chat says hello!", "Just joined to say hi 💜"];
  if (/\b(game|gaming|win|lose|minecraft|fortnite|roblox|dice|case)\b/.test(msg)) return ["Big W incoming 🔥", "You got this!", "This game looks fun", "We believe!"];
  if (/\b(thank|thanks|love|appreciate)\b/.test(msg)) return ["We love you too 💜", "Always here!", "Much love back"];
  if (/\b(how|what|why|when|question|think)\b|\?/.test(msg)) return ["Good question!", "I was wondering too!", "Tell us more 👀"];
  if (/\b(sing|music|song|dance)\b/.test(msg)) return ["Music vibes 🎵", "Chat dance break!", "The energy is unreal"];
  if (/\b(sad|tired|stress|bad)\b/.test(msg)) return ["Sending good vibes 💜", "You got this!", "Chat is here for you"];
  return ["Wait I heard that 👀", "Chat agrees!", "That's so real", "Tell us more!", "W take", "No way 😂"];
}
function randomIndex(max) {
  if (globalThis.crypto && crypto.getRandomValues) {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    return n[0] % max;
  }
  return Math.floor(Math.random() * max);
}
function addComment(name, text, gift = 0) {
  const entry = { id: Date.now() + Math.random(), name, text, gift };
  state.comments = [...(Array.isArray(state.comments) ? state.comments : []), entry].slice(-60);
  persist();
  if (route() === "live") {
    const log = $("#chat-log");
    if (!log) return;
    const item = document.createElement("div");
    item.className = "chat-line" + (gift ? " gifted" : "");
    const username = document.createElement("strong");
    username.textContent = name;
    const message = document.createElement("span");
    message.textContent = text;
    item.append(username, message);
    log.append(item);
    while (log.children.length > 50) log.firstElementChild.remove();
    scrollChat();
    $("#live-viewers").textContent = number(state.viewers);
    $("#live-gifts").textContent = number(state.gifts);
  }
}
function scrollChat() {
  const node = $("#chat-log");
  if (node) node.scrollTop = node.scrollHeight;
}
function tickLive() {
  if (!state.live) return;
  state.viewers = Math.max(0, state.viewers + randomIndex(71) - 35);
  state.likes += randomIndex(90);
  if (randomIndex(10) === 0) {
    const coins = [1, 2, 5, 10, 25][randomIndex(5)];
    state.gifts += coins;
    addComment(CHAT_NAMES[randomIndex(CHAT_NAMES.length)], "🎁 Sent " + coins + " imaginary gift coins!", coins);
  } else addComment(CHAT_NAMES[randomIndex(CHAT_NAMES.length)], CHAT_LINES[randomIndex(CHAT_LINES.length)]);
  persist();
  if ($("#live-likes")) $("#live-likes").textContent = number(state.likes);
}
function runTicker() {
  clearInterval(liveTicker);
  if (state.live) liveTicker = setInterval(tickLive, 2900);
}
function livePage() {
  const chat = (Array.isArray(state.comments) ? state.comments : []).slice(-50);
  return '<div class="broadcast-app"><div class="broadcast-stage"><div class="broadcast-scene"><div class="broadcast-bg-orb"></div><div class="broadcast-top"><span class="broadcast-streamer"><b>' + htmlEscape((state.profile || "G").slice(0,1).toUpperCase()) + '</b><span><strong>' + htmlEscape(state.profile || "Your channel") + '</strong><small>ROLEPLAY BROADCAST</small></span></span><span class="live-indicator">' + (state.live ? "● LIVE · SIM" : "● OFFLINE") + '</span><span class="broadcast-viewers">◉ <span id="live-viewers">' + number(state.viewers) + '</span></span></div>' +
    '<div class="broadcast-center"><span>✦</span><h1>' + (state.live ? 'You are live!' : 'Your spotlight.') + '</h1><p>' + (state.live ? 'Your simulated audience is listening.' : 'Tap Go Live to start a pretend broadcast.') + '</p></div>' +
    '<div class="broadcast-bottom"><div class="broadcast-social-proof"><span>♥ <b id="live-likes">' + number(state.likes) + '</b></span><span>🎁 <b id="live-gifts">' + number(state.gifts) + '</b> fictional gifts</span></div>' +
    '<div class="broadcast-chat-overlay" id="chat-log" role="log" aria-live="polite">' + (chat.length ? chat.map((entry) => '<div class="chat-line' + (entry.gift ? " gifted" : "") + '"><strong>' + htmlEscape(entry.name) + '</strong><span>' + htmlEscape(entry.text) + '</span></div>').join("") : '<div class="chat-placeholder">Your simulated chat will appear here. Say something to get a reaction!</div>') + '</div>' +
    '<form class="broadcast-input" id="chat-form"><input name="speech" maxlength="220" autocomplete="off" placeholder="Talk to the fake audience…" aria-label="Talk to the simulated livestream" required><button type="button" data-action="microphone" aria-label="Speak a message">🎙</button><button type="submit" aria-label="Send message">➤</button></form></div><span class="broadcast-sim-stamp">LARP SIMULATION · NO REAL VIEWERS</span></div></div>' +
    '<aside class="broadcast-tools"><div class="broadcast-intro"><span class="section-kicker">LIVE CREATOR</span><h2>Your live room</h2><p>All comments, donations and viewer counts are simulated. Nothing is being broadcast.</p></div><button type="button" class="' + (state.live ? "stop-button" : "primary-button") + ' broadcast-start" data-action="toggle-live">' + (state.live ? "■ End simulated live" : "● Go live (simulation)") + '</button><div class="broadcast-metrics"><div><small>VIEWERS</small><strong>' + number(state.viewers) + '</strong></div><div><small>FAKE GIFTS</small><strong>' + number(state.gifts) + '</strong></div><div><small>LIKES</small><strong>' + number(state.likes) + '</strong></div></div><div class="broadcast-help"><h3>Reactive chat</h3><p>Type or speak. The fictional viewers react to your words, hype you up and send pretend gifts.</p><p>No AI key is exposed. Optional speech recognition may use your browser speech provider.</p></div><a class="broadcast-social-link" href="#social">Visit creator studio ↗</a></aside></div>';
}
function casesPage() {
  const drop = state.latestDrop;
  return pageTitle("COLLECTIBLE DROPS", "Unbox the unexpected.", "Only imaginary play credits, no real prizes. The exact odds are disclosed and each roll uses a weighted random selection.") +
    '<div class="case-balance"><span>YOUR ROLEPLAY TOKENS</span><strong>' + usd(state.balance) + '</strong><span>Shared with LARP bank demos, not BlockBet</span></div>' +
    '<div class="case-grid">' + CASES.map((item, i) => '<div class="case-tile ' + item.color + '"><span class="case-edition">' + item.label + '</span><div class="case-art"><span>▣</span><span class="case-shine">✦</span></div><h2>' + item.name + '</h2><p>A fictional collectible mystery box.</p><div class="case-cta"><span>' + usd(item.cost * 100) + ' play</span><button type="button" data-action="open-case" data-id="' + i + '" ' + (state.balance < item.cost * 100 ? "disabled" : "") + '>Open case ↗</button></div></div>').join("") + '</div>' +
    (drop ? '<section class="panel latest-drop"><div class="eyebrow">YOUR LAST DROP</div><div class="drop-icon ' + TIERS[drop.tier].className + '">' + TIERS[drop.tier].icon + '</div><h2>' + TIERS[drop.tier].name + ' collectible</h2><p>You won ' + usd(drop.value) + ' fictional credits. This has no real-world value.</p><span>' + TIERS[drop.tier].odds + '% drop rate</span></section>' : "") +
    '<section class="panel odds-panel"><div class="panel-title"><div><h2>Transparent drop rates</h2><p>Every case uses the same weighted tier probabilities.</p></div><span>100% TOTAL</span></div><div class="odds-grid">' + TIERS.map((item) => '<div class="odds-row"><div class="odds-icon ' + item.className + '">' + item.icon + '</div><div><strong>' + item.name + '</strong><small>' + item.multiplier + '× base case value as play credit</small></div><b>' + item.odds + '%</b></div>').join("") + '</div><p class="odds-note">Sample odds designed for this fictional game (not claimed to represent any real case-opening site). Expected return is approximately 60.6% of case cost in play credits. Each roll is independent; rare results are never guaranteed.</p></section>';
}
function showProfile() {
  const root = $("#dialog-root");
  root.innerHTML = '<div class="modal-backdrop" data-action="close-modal"><form class="profile-dialog" id="profile-form" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-head"><span class="dialog-symbol">✦</span><button aria-label="Close" type="button" data-action="close-modal">✕</button></div><h2 id="dialog-title">' + (state.profile ? "Edit your roleplay identity" : "Create a roleplay character") + '</h2><p>Pick a display name on this device. This is not an online account or a real secure sign-in.</p><label for="profile-name">CHARACTER NAME</label><input id="profile-name" name="name" maxlength="22" value="' + htmlEscape(state.profile || "") + '" placeholder="e.g. NovaPlayer" autocomplete="off" required autofocus><button type="submit" class="primary-button full">Save local profile</button>' + (state.profile ? '<button type="button" data-action="sign-out" class="text-button">Sign out of this device</button>' : "") + '<small>Never enter real passwords, account details or card numbers.</small></form></div>';
  $("#profile-name").focus();
}
function closeProfile() { $("#dialog-root").innerHTML = ""; }
function adjustBalance(amount, label) {
  const next = Math.min(1000000000, Math.max(0, state.balance + amount));
  const applied = next - state.balance;
  if (!applied) { toast("Not enough fictional credits."); return; }
  state.balance = next;
  state.activity = [[label, applied, new Date().toLocaleString()], ...(Array.isArray(state.activity) ? state.activity : [])].slice(0, 10);
  persist(); render();
}
function sendSpeech(text) {
  const message = text.trim().slice(0, 220);
  if (!message) return;
  if (!state.live) { toast("Start the simulated livestream first."); return; }
  addComment(state.profile || "you", message);
  const candidates = reactTo(message);
  const responseCount = 2 + randomIndex(2);
  for (let i = 0; i < responseCount; i++) {
    const response = candidates[(i + randomIndex(candidates.length)) % candidates.length];
    setTimeout(() => { if (state.live) addComment(CHAT_NAMES[randomIndex(CHAT_NAMES.length)], response); }, 400 + i * 700);
  }
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action], [data-route-go]");
  if (!button) return;
  const action = button.dataset.action;
  const id = Number(button.dataset.id);
  if (button.dataset.routeGo) { location.hash = "#" + button.dataset.routeGo; return; }
  if (action === "fullscreen") {
    const target = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => toast("Use your browser to leave fullscreen."));
    } else if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => toast("Fullscreen was blocked. Use your browser's full-screen option."));
    } else toast("Use your browser's full-screen option.");
    return;
  }
  if (action === "launch-bank") { location.hash = "#banks"; return; }
  if (action === "launch-social") {
    if (PLATFORMS[button.dataset.id]) {
      state.socialPlatform = button.dataset.id;
      persist();
      location.hash = "#social";
      render();
    }
    return;
  }
  if (action === "profile") { showProfile(); return; }
  if (action === "close-modal") { if (event.target.closest(".profile-dialog") && !event.target.matches('[data-action="close-modal"]')) return; closeProfile(); return; }
  if (action === "sign-out") { state.profile = ""; persist(); closeProfile(); render(); toast("Signed out of local character."); return; }
  if (action === "pick-bank" && BANKS[id]) { state.bank = id; persist(); render(); return; }
  if (action === "credit") { adjustBalance(50000, "Demo credit added"); return; }
  if (action === "spend") { adjustBalance(-2500, "Pretend purchase"); return; }
  if (action === "show-cards") { const catalog = $("#card-catalog"); if (catalog) { catalog.hidden = !catalog.hidden; if (!catalog.hidden) catalog.scrollIntoView({ block: "nearest", behavior: "smooth" }); } return; }
  if (action === "select-card" && CARDS[id]) { state.activeCard = id; persist(); render(); return; }
  if (action === "add-card" && CARDS[id]) { if (!state.cards.includes(id)) state.cards.push(id); state.activeCard = id; persist(); render(); toast("Virtual card added to your collection."); return; }
  if (action === "remove-card") {
    state.cards = (Array.isArray(state.cards) ? state.cards : []).filter((v) => v !== state.activeCard);
    state.activeCard = state.cards[0] === undefined ? 0 : state.cards[0];
    persist(); render(); toast("Card removed from your local collection."); return;
  }
  if (action === "demo-tap") { toast("✓ Simulated tap successful. No payment was made."); return; }
  if (action === "platform" && PLATFORMS[button.dataset.id]) { state.socialPlatform = button.dataset.id; persist(); render(); return; }
  if (action === "grow") { const idx = Number(button.dataset.index); const bump = Number(button.dataset.increment); const p = state.socialPlatform; if (idx >= 0 && idx <= 2 && bump > 0) { state.social[p][idx] += bump; persist(); render(); } return; }
  if (action === "toggle-live") {
    state.live = !state.live;
    if (state.live) { state.comments = []; addComment("moderator.bot", "Welcome! All comments and viewer counts here are simulated."); }
    persist(); runTicker(); render(); toast(state.live ? "Demo stream started — no broadcast is taking place." : "Simulated stream ended."); return;
  }
  if (action === "microphone") {
    if (!state.live) { toast("Start the demo stream first."); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast("Speech input is not available in this browser. Type your message instead."); return; }
    try {
      const recognition = new Recognition();
      recognition.lang = "en-GB"; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onresult = (result) => { const text = result.results[0][0].transcript || ""; sendSpeech(text); };
      recognition.onerror = () => toast("Microphone not available. You can type instead.");
      recognition.start();
      toast("Listening for one message. Your browser may process speech through its speech service.");
    } catch { toast("Could not start microphone input."); }
    return;
  }
  if (action === "open-case" && CASES[id]) {
    const c = CASES[id];
    const cost = c.cost * 100;
    if (state.balance < cost) { toast("Not enough pretend credits. Add some in Virtual Banks."); return; }
    const roll = randomIndex(10000) / 100;
    let sum = 0;
    let tier = 0;
    for (let i = 0; i < TIERS.length; i++) { sum += TIERS[i].odds; if (roll < sum) { tier = i; break; } }
    const winnings = Math.round(cost * TIERS[tier].multiplier);
    state.balance = Math.min(1000000000, state.balance - cost + winnings);
    state.latestDrop = { tier, value: winnings };
    state.caseHistory = [{ caseName: c.name, tier, value: winnings }, ...(state.caseHistory || [])].slice(0, 10);
    persist(); render(); toast("Unboxed: " + TIERS[tier].name + " · " + usd(winnings) + " demo credits!");
  }
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id === "profile-form") {
    event.preventDefault();
    const value = String(new FormData(form).get("name") || "").trim().slice(0, 22);
    if (!value) return;
    state.profile = value;
    persist(); closeProfile(); render(); toast("Roleplay profile saved on this device."); return;
  }
  if (form.id === "post-form") {
    event.preventDefault();
    const title = String(new FormData(form).get("title") || "").trim().slice(0, 80);
    if (!title) return;
    state.posts = [title, ...(Array.isArray(state.posts) ? state.posts : [])].slice(0, 6);
    state.social[state.socialPlatform][1] += 500;
    persist(); render(); toast("Demo post created locally — not published."); return;
  }
  if (form.id === "chat-form") {
    event.preventDefault();
    const speech = String(new FormData(form).get("speech") || "");
    form.reset();
    sendSpeech(speech);
  }
});
window.addEventListener("hashchange", () => { render(); $("#screen").scrollIntoView({ block: "start" }); });
window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeProfile(); });
runTicker();
render();
