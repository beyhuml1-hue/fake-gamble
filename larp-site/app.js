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
  updateChrome();
  const page = route();
  const views = { home: homePage, banks: banksPage, "google-wallet": () => walletPage("google"), "apple-wallet": () => walletPage("apple"), social: socialPage, live: livePage, cases: casesPage };
  $("#screen").innerHTML = views[page]();
  if (page === "live") scrollChat();
}
function homePage() {
  const name = state.profile || "Explorer";
  const features = [
    ["◆", "BLOCKBET", "BlockBet Casino", "Your original play-money gaming world.", "https://playblockbet.com", "bet", true],
    ["▤", "12 ORIGINAL BANKS", "Virtual Banking", "Switch between beautifully themed demo banks.", "#banks", "banks", false],
    ["◈", "12 PREMIUM STYLES", "Wallet Collection", "Collect and customise cards that look amazing.", "#google-wallet", "wallet", false],
    ["▧", "CREATOR TOOLS", "Social Studio", "Build a fictional following and track your growth.", "#social", "studio", false],
    ["●", "REACTIVE CHAT", "Go Live", "Simulated viewers, gifts and comments that respond.", "#live", "live", false],
    ["▣", "VISIBLE DROP ODDS", "Case Drops", "Unbox collectible items with published probabilities.", "#cases", "cases", false]
  ];
  return '<div class="home">' +
    '<section class="hero"><div class="hero-copy"><div class="eyebrow"><span class="status-dot"></span> THE ALTERNATE REALITY STARTS HERE</div><h1>Your world.<br><em>Your rules.</em></h1><p>A universe of experiences, built for imagination. Manage fictional money, customise luxury cards, become a creator and go live. Nothing real. Everything fun.</p><div class="hero-buttons"><a class="primary-button" href="#banks">Explore the universe <span>↗</span></a><button class="secondary-button" type="button" data-action="profile">Create your character</button></div></div><div class="hero-art" aria-hidden="true"><div class="orbit-ring ring-a"></div><div class="orbit-ring ring-b"></div><div class="planet">✦</div><span class="orbit-label label-a">◈ UNLIMITED STYLE</span><span class="orbit-label label-b">● GO LIVE</span><span class="orbit-label label-c">✧ YOUR REALITY</span></div></section>' +
    '<section class="overview-strip"><div><small>YOUR CHARACTER</small><strong>' + htmlEscape(name) + '</strong></div><div><small>ROLEPLAY BALANCE</small><strong>' + usd(state.balance) + '</strong></div><div><small>EXPERIENCES</small><strong>7 unique worlds</strong></div><div><small>UNIVERSE STATUS</small><strong class="text-success">● Simulation active</strong></div></section>' +
    '<div class="section-heading"><div><div class="eyebrow">ALL YOUR WORLDS</div><h2>Choose your next experience<span class="heading-dot">.</span></h2></div><span>Every number, card and account is fictional</span></div>' +
    '<div class="experience-grid">' + features.map((f) => '<a class="experience-card ' + f[5] + '" href="' + f[4] + '"' + (f[6] ? ' target="_blank" rel="noopener noreferrer"' : "") + '><span class="experience-symbol">' + f[0] + '</span><span class="experience-arrow">↗</span><div><small>' + f[1] + '</small><h3>' + f[2] + '</h3><p>' + f[3] + '</p></div></a>').join("") + '</div>' +
    '<div class="statement-panel"><span>✦</span><div><strong>It looks real. It is not.</strong><p>LARP is a labelled roleplay simulation. No real banks, social networks, payments or money are connected.</p></div>' + tag(true) + '</div></div>';
}
function banksPage() {
  const idx = Math.max(0, Math.min(BANKS.length - 1, Number(state.bank) || 0));
  const bank = BANKS[idx];
  const history = Array.isArray(state.activity) && state.activity.length ? state.activity : [
    ["Coffee & croissant (example)", -1250, "Sample transaction"],
    ["Demo funds (example)", 70000, "Sample transaction"],
    ["Monthly subscription (example)", -999, "Sample transaction"]
  ];
  return pageTitle("YOUR FINANCIAL WORLD", "Choose your bank.", "12 beautifully designed fictional institutions. Balances are imaginary, local and never linked to a bank.") +
    '<div class="bank-layout"><section class="panel bank-picker"><div class="panel-title"><h2>Bank collection</h2><span>12 THEMES</span></div><div class="bank-grid">' + BANKS.map((b, i) => '<button type="button" data-action="pick-bank" data-id="' + i + '" class="bank-choice' + (idx === i ? ' chosen' : '') + '"><span class="bank-logo" style="background:' + b[2] + '">' + b[1] + '</span><strong>' + b[0] + '</strong><span>' + (idx === i ? "✓" : "↗") + '</span></button>').join("") + '</div></section>' +
    '<section class="bank-preview"><div class="bank-display panel"><div class="bank-display-top"><div><span class="bank-logo" style="background:' + bank[2] + '">' + bank[1] + '</span><strong>' + bank[0] + '</strong></div><span class="mini-tag">SIMULATED</span></div><div class="balance-detail"><small>YOUR FICTIONAL BALANCE</small><h2>' + usd(state.balance) + '</h2><p>' + bank[3] + '</p></div><div class="bank-account">Everyday account <span>•••• 0000 · DEMO</span></div><div class="bank-action-row"><button type="button" data-action="credit"><span>＋</span>Add $500 demo</button><button type="button" data-action="spend"><span>↗</span>Spend $25 demo</button></div></div>' +
    '<div class="panel transactions"><div class="panel-title"><h2>Recent activity</h2><span>LOCAL ONLY</span></div>' + history.slice(0, 6).map((h) => '<div class="activity-row"><span class="activity-icon">' + (h[1] < 0 ? "↗" : "↙") + '</span><span><strong>' + htmlEscape(h[0]) + '</strong><small>' + htmlEscape(h[2]) + '</small></span><b class="' + (h[1] < 0 ? "negative" : "positive") + '">' + (h[1] > 0 ? "+" : h[1] < 0 ? "−" : "") + usd(Math.abs(h[1])) + '</b></div>').join("") + '</div><div class="notice">ⓘ This is not a bank. It cannot move funds, verify an account, generate a statement or make any payment.</div></section></div>';
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
  return pageTitle("YOUR DIGITAL WALLET", title + ".", (isApple ? "Apple Pay-style" : "Google Pay-style") + " concept with original card designs. No real cards, accounts or payments.") +
    '<div class="wallet-layout"><div class="wallet-phone ' + (isApple ? "orchard" : "droid") + '"><div class="phone-status"><span>9:41</span><span>●●● ▰</span></div><div class="wallet-phone-heading"><span class="wallet-symbol">' + (isApple ? "◉" : "◈") + '</span><div><small>MY COLLECTION</small><h2>' + title + '</h2></div><span>＋</span></div><div class="main-card-holder">' + cardMarkup(chosen) + '</div><div class="card-pagination">● <span>● ●</span></div><div class="phone-actions"><button data-action="demo-tap" type="button"><span>◎</span>Demo tap</button><button type="button" data-action="show-cards"><span>＋</span>Add card</button></div><div class="phone-tip">No real NFC, payment credentials, transactions or card numbers. Just a design collection.</div><div class="phone-handle"></div></div>' +
    '<div class="panel card-collection"><div class="panel-title"><div><h2>Your card collection</h2><p>Tap to make a card the featured design.</p></div><button type="button" class="outline-button" data-action="show-cards">＋ Add card</button></div><div class="owned-cards">' + (available.length ? available.map((idx) => '<button type="button" class="owned-card' + (chosen === idx ? " active" : "") + '" data-action="select-card" data-id="' + idx + '">' + cardMarkup(idx, true) + '<span><strong>' + CARDS[idx][0] + '</strong><small>' + CARDS[idx][2] + '</small></span><span class="owned-indicator">' + (chosen === idx ? "✓" : "↗") + '</span></button>').join("") : '<p>No cards collected. Add your first virtual design.</p>') + '</div><button type="button" class="text-button" data-action="remove-card">Remove selected card</button><div class="card-collection-foot">ALL CARDS ARE FICTIONAL • NUMBER ENDS 0000</div><div class="card-catalog" id="card-catalog" hidden><h3>Choose a collectible design</h3><div class="catalog-grid">' + CARDS.map((c, i) => '<button type="button" data-action="add-card" data-id="' + i + '">' + cardMarkup(i, true) + '<strong>' + c[0] + '</strong><small>' + (available.includes(i) ? "Select" : "Collect card") + '</small></button>').join("") + '</div></div></div></div>';
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
  return pageTitle("THE LIVE EXPERIENCE", "You're on the air.", "A simulated livestream with fictional viewers, reactive chat and pretend gifts. No video is streamed to anyone.") +
    '<div class="live-layout"><div class="live-preview panel"><div class="live-video"><div class="live-top-row"><span class="live-indicator">' + (state.live ? "● LIVE SIMULATION" : "● OFFLINE") + '</span><span class="viewer-indicator">◉ <span id="live-viewers">' + number(state.viewers) + '</span> fake viewers</span></div><div class="live-visual"><div class="live-pulse">✦</div><h2>' + (state.live ? "YOUR STAGE IS LIVE" : "YOUR STAGE, YOUR RULES") + '</h2><p>' + (state.live ? "The simulated audience is here. Talk to your chat below." : "Press Go Live to start your imaginary stream.") + '</p></div><span class="live-watermark">LARP • NOT A REAL BROADCAST</span></div><div class="live-controls"><div><span><b id="live-likes">' + number(state.likes) + '</b><small>Simulated likes</small></span><span><b id="live-gifts">' + number(state.gifts) + '</b><small>Imaginary gift coins</small></span></div><button type="button" class="' + (state.live ? "stop-button" : "primary-button") + '" data-action="toggle-live">' + (state.live ? "■ End demo live" : "● Go live (demo)") + '</button></div><div class="notice">ⓘ Neither camera nor audio is broadcast, recorded or sent to a platform. If microphone input is enabled, your browser transcribes locally or using its speech service.</div></div>' +
    '<div class="panel chat-panel"><div class="chat-heading"><div><span>◉</span><h2>Live chat</h2></div><span>SIMULATED COMMENTS</span></div><div class="chat-log" id="chat-log" role="log" aria-live="polite">' + (chat.length ? chat.map((entry) => '<div class="chat-line' + (entry.gift ? " gifted" : "") + '"><strong>' + htmlEscape(entry.name) + '</strong><span>' + htmlEscape(entry.text) + '</span></div>').join("") : '<div class="chat-placeholder">Your fictional audience is ready. Start the live and type something!</div>') + '</div><form class="chat-form" id="chat-form"><input maxlength="220" name="speech" autocomplete="off" placeholder="Say something to your fake viewers…" aria-label="Message to the simulator" required><button type="button" data-action="microphone" aria-label="Use microphone to type">🎙</button><button class="primary-button" type="submit">Send ↗</button></form><p class="chat-footnote">Comments are generated by local rules. No AI token or private key is exposed.</p></div></div>';
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
