import { useId, type ReactNode } from "react";

const BACKGROUNDS: Record<string, [string, string]> = {
  dice: ["#1d4ed8", "#60a5fa"],
  mines: ["#be123c", "#fb7185"],
  plinko: ["#6d28d9", "#c084fc"],
  roulette: ["#9a3412", "#fdba74"],
  coinflip: ["#1d4ed8", "#38bdf8"],
  limbo: ["#c2410c", "#fb923c"],
  blackjack: ["#9f1239", "#fb7185"],
  towers: ["#0e7490", "#67e8f9"],
  slide: ["#a16207", "#facc15"],
  crash: ["#b91c1c", "#f87171"],
  flight: ["#0369a1", "#7dd3fc"],
  baccarat: ["#047857", "#6ee7b7"],
  hilo: ["#1e3a8a", "#60a5fa"],
  keno: ["#6d28d9", "#e879f9"],
  snakes: ["#15803d", "#4ade80"],
  digger: ["#0f766e", "#5eead4"],
  cases: ["#1d4ed8", "#93c5fd"],
  "case-battles": ["#7c2d12", "#fdba74"],
  packs: ["#5b21b6", "#f0abfc"],
};

function DiceFace({ x, y, fill = "#f8fafc" }: { x: number | string; y: number | string; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="54" height="54" rx="10" fill={fill} />
      <circle cx="14" cy="14" r="4" fill="#1e293b" />
      <circle cx="40" cy="14" r="4" fill="#1e293b" />
      <circle cx="27" cy="27" r="4" fill="#1e293b" />
      <circle cx="14" cy="40" r="4" fill="#1e293b" />
      <circle cx="40" cy="40" r="4" fill="#1e293b" />
    </g>
  );
}

function shapes(id: string): ReactNode {
  switch (id) {
    case "dice":
      return (
        <g>
          <g transform="rotate(-18 48 78)"><DiceFace x="18" y="48" /></g>
          <g transform="rotate(16 104 70)"><DiceFace x="78" y="42" fill="#fff" /></g>
        </g>
      );
    case "mines":
      return (
        <g>
          <ellipse cx="78" cy="118" rx="36" ry="10" fill="#000" opacity="0.25" />
          <circle cx="70" cy="78" r="34" fill="#fb7185" />
          <circle cx="70" cy="78" r="16" fill="#4c0519" />
          <circle cx="92" cy="58" r="16" fill="#111827" />
          <rect x="88" y="34" width="8" height="16" rx="2" fill="#f8fafc" />
          <path d="M100 40c8-10 16-6 14 2" fill="none" stroke="#fde68a" strokeWidth="3" />
          <circle cx="112" cy="48" r="4" fill="#fde68a" />
        </g>
      );
    case "plinko":
      return (
        <g fill="#f5f3ff">
          <circle cx="80" cy="28" r="8" fill="#fde68a" />
          {[0, 1, 2, 3, 4].map((row) =>
            Array.from({ length: row + 1 }, (_, col) => (
              <circle key={`${row}-${col}`} cx={80 - row * 12 + col * 24} cy={48 + row * 18} r="6" />
            )),
          )}
        </g>
      );
    case "roulette":
      return (
        <g>
          <circle cx="80" cy="78" r="48" fill="#7c2d12" />
          <circle cx="80" cy="78" r="40" fill="#451a03" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M80 78 L${80 + Math.cos((i * 30 * Math.PI) / 180) * 40} ${78 + Math.sin((i * 30 * Math.PI) / 180) * 40} A40 40 0 0 1 ${80 + Math.cos(((i + 1) * 30 * Math.PI) / 180) * 40} ${78 + Math.sin(((i + 1) * 30 * Math.PI) / 180) * 40} Z`} fill={i % 2 ? "#ef4444" : "#111827"} />
          ))}
          <circle cx="80" cy="78" r="14" fill="#fbbf24" />
          <circle cx="80" cy="78" r="5" fill="#fff" />
        </g>
      );
    case "coinflip":
      return (
        <g>
          <ellipse cx="80" cy="118" rx="34" ry="8" fill="#000" opacity="0.25" />
          <circle cx="80" cy="76" r="40" fill="#fbbf24" />
          <circle cx="80" cy="76" r="30" fill="none" stroke="#b45309" strokeWidth="4" />
          <path d="M80 58v36M70 68c4-6 16-6 20 0M70 84c4 6 16 6 20 0" fill="none" stroke="#92400e" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "limbo":
      return (
        <g>
          <circle cx="80" cy="84" r="36" fill="#fdba74" />
          <circle cx="80" cy="84" r="16" fill="#7c2d12" />
          <path d="M80 28l14 22H66z" fill="#fff" />
          <rect x="74" y="48" width="12" height="22" rx="3" fill="#fff" />
        </g>
      );
    case "blackjack":
      return (
        <g>
          <g transform="rotate(-12 58 80)">
            <rect x="34" y="36" width="48" height="68" rx="6" fill="#fff" />
            <text x="42" y="58" fontSize="16" fontFamily="Inter, sans-serif" fill="#dc2626" fontWeight="700">A</text>
            <path d="M58 78c8 10 8 10 0 18c-8-8-8-8 0-18z" fill="#dc2626" />
          </g>
          <g transform="rotate(10 100 84)">
            <rect x="76" y="40" width="48" height="68" rx="6" fill="#fff" />
            <text x="84" y="64" fontSize="16" fontFamily="Inter, sans-serif" fill="#111827" fontWeight="700">K</text>
            <path d="M100 80c6 8 10 6 10 0c0 8 2 10 8 8c-8 8-14 6-18 0z" fill="#111827" />
          </g>
        </g>
      );
    case "towers":
      return (
        <g>
          {[0, 1, 2, 3].map((step) => (
            <rect key={step} x={36 + step * 8} y={108 - step * 22} width={88 - step * 16} height="18" rx="4" fill={step % 2 ? "#67e8f9" : "#cffafe"} />
          ))}
          <path d="M80 18l6 12h-12z" fill="#fef08a" />
        </g>
      );
    case "slide":
      return (
        <g>
          <rect x="28" y="78" width="70" height="28" rx="6" fill="#fde68a" />
          <rect x="40" y="58" width="70" height="28" rx="6" fill="#facc15" />
          <rect x="56" y="40" width="64" height="26" rx="6" fill="#fef3c7" />
          <circle cx="108" cy="52" r="10" fill="#f59e0b" />
        </g>
      );
    case "crash":
      return (
        <g transform="rotate(-28 80 80)">
          <path d="M48 70h52l16 14-16 14H48z" fill="#fecaca" />
          <path d="M48 70c-18 6-22 22 0 28" fill="#ef4444" />
          <circle cx="86" cy="84" r="7" fill="#7f1d1d" />
          <path d="M116 76l18 8-18 8z" fill="#f8fafc" />
        </g>
      );
    case "flight":
      return (
        <g>
          <ellipse cx="40" cy="46" rx="18" ry="8" fill="#fff" opacity="0.8" />
          <ellipse cx="112" cy="38" rx="22" ry="9" fill="#fff" opacity="0.75" />
          <path d="M28 96c28-8 40-28 70-24 10 1 18 8 28 6" fill="none" stroke="#fde68a" strokeWidth="4" />
          <path d="M46 92l48-8 8 10-28 6-14 16-8-12z" fill="#f8fafc" />
          <path d="M70 90l8-16 10 14z" fill="#bae6fd" />
        </g>
      );
    case "baccarat":
      return (
        <g>
          <rect x="28" y="48" width="40" height="56" rx="5" fill="#fff" transform="rotate(-8 48 76)" />
          <rect x="90" y="48" width="40" height="56" rx="5" fill="#fff" transform="rotate(8 110 76)" />
          <circle cx="58" cy="112" r="12" fill="#ef4444" />
          <circle cx="80" cy="118" r="12" fill="#f8fafc" />
          <circle cx="102" cy="112" r="12" fill="#111827" />
        </g>
      );
    case "hilo":
      return (
        <path d="M80 28c22 24 34 36 34 54a34 34 0 0 1-68 0c0-18 12-30 34-54z" fill="#0f172a" stroke="#e2e8f0" strokeWidth="4" />
      );
    case "keno":
      return (
        <g>
          <circle cx="58" cy="58" r="24" fill="#7c3aed" />
          <circle cx="104" cy="64" r="26" fill="#f8fafc" />
          <circle cx="78" cy="104" r="24" fill="#c026d3" />
          <text x="58" y="64" textAnchor="middle" fontSize="14" fontFamily="Inter, sans-serif" fill="#fff" fontWeight="800">12</text>
          <text x="104" y="70" textAnchor="middle" fontSize="16" fontFamily="Inter, sans-serif" fill="#6d28d9" fontWeight="800">7</text>
          <text x="78" y="110" textAnchor="middle" fontSize="14" fontFamily="Inter, sans-serif" fill="#fff" fontWeight="800">24</text>
        </g>
      );
    case "snakes":
      return (
        <g>
          <path d="M40 110c10-30 30-10 30-30s-10-24 8-28 28 8 36-6 8 40-6 48-40 8-48 20 4 16-20 4z" fill="none" stroke="#bbf7d0" strokeWidth="12" strokeLinecap="round" />
          <circle cx="112" cy="42" r="8" fill="#ecfccb" />
          <circle cx="116" cy="40" r="2" fill="#14532d" />
          <g transform="translate(58 78) scale(0.55)"><DiceFace x="0" y="0" /></g>
        </g>
      );
    case "digger":
      return (
        <g>
          <path d="M30 110h100v16H30z" fill="#134e4a" />
          <path d="M46 110c8-28 20-40 34-40s26 12 34 40" fill="#115e59" />
          <circle cx="62" cy="96" r="6" fill="#67e8f9" />
          <circle cx="96" cy="90" r="5" fill="#fde68a" />
          <path d="M48 86l46-40 10 8-40 46z" fill="#f8fafc" />
          <path d="M86 40l18-8-6 18z" fill="#e2e8f0" />
          <rect x="78" y="78" width="28" height="10" rx="3" fill="#92400e" transform="rotate(-40 92 83)" />
        </g>
      );
    case "cases":
      return (
        <g>
          <rect x="36" y="58" width="88" height="58" rx="8" fill="#dbeafe" />
          <path d="M36 74h88" stroke="#1d4ed8" strokeWidth="6" />
          <rect x="72" y="68" width="16" height="16" rx="3" fill="#fbbf24" />
        </g>
      );
    case "case-battles":
      return (
        <g>
          <rect x="24" y="64" width="48" height="40" rx="6" fill="#ffedd5" />
          <rect x="88" y="64" width="48" height="40" rx="6" fill="#fecaca" />
          <path d="M72 84h16" stroke="#fff" strokeWidth="4" />
        </g>
      );
    case "packs":
      return (
        <g>
          <rect x="48" y="36" width="64" height="88" rx="8" fill="#f5d0fe" transform="rotate(8 80 80)" />
          <path d="M80 36v88" stroke="#a21caf" strokeWidth="6" />
        </g>
      );
    default:
      return <circle cx="80" cy="78" r="28" fill="#fff" />;
  }
}

export function TileArt({ id }: { id: string }) {
  const uid = useId().replace(/:/g, "");
  const [from, to] = BACKGROUNDS[id] ?? ["#1e3a8a", "#60a5fa"];
  return (
    <svg className="depo-tile-art" viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
        <radialGradient id={`${uid}-shine`} cx="30%" cy="18%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="160" height="160" fill={`url(#${uid}-bg)`} />
      {shapes(id)}
      <rect width="160" height="160" fill={`url(#${uid}-shine)`} />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg className="depo-logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="depo-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8eb6ff" />
          <stop offset="1" stopColor="#2457d6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#depo-logo)" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="#f6c445" strokeWidth="3" />
      <circle cx="16" cy="16" r="2.3" fill="#fff" />
    </svg>
  );
}

export function ArcadeHeroArt() {
  return (
    <svg className="depo-hero-art" viewBox="0 0 220 170" aria-hidden="true">
      <ellipse cx="150" cy="40" rx="36" ry="16" fill="#dbeafe" opacity="0.55" />
      <ellipse cx="186" cy="58" rx="24" ry="12" fill="#eff6ff" opacity="0.45" />
      <g>
        <rect x="118" y="78" width="46" height="36" rx="6" fill="#b45309" />
        <path d="M114 78h54l-6-14h-42z" fill="#f59e0b" />
        <rect x="136" y="88" width="12" height="10" rx="2" fill="#fde68a" />
        <circle cx="142" cy="100" r="3" fill="#fbbf24" />
      </g>
      <g>
        <ellipse cx="78" cy="128" rx="22" ry="6" fill="#000" opacity="0.25" />
        <path d="M62 92h32l6 28H56z" fill="#1d4ed8" />
        <path d="M66 92c2-16 28-16 30 0" fill="#0f172a" />
        <circle cx="78" cy="74" r="16" fill="#fdba74" />
        <path d="M64 70c2-16 28-18 32-2-8-6-24-6-32 2z" fill="#7c2d12" />
        <circle cx="73" cy="74" r="1.6" fill="#1e293b" />
        <circle cx="83" cy="74" r="1.6" fill="#1e293b" />
        <path d="M74 80c2 2 6 2 8 0" fill="none" stroke="#9a3412" strokeWidth="1.4" />
        <rect x="66" y="118" width="10" height="16" rx="3" fill="#1e3a8a" />
        <rect x="82" y="118" width="10" height="16" rx="3" fill="#1e3a8a" />
      </g>
    </svg>
  );
}

export function GiftHeroArt() {
  return (
    <svg className="depo-hero-art" viewBox="0 0 180 150" aria-hidden="true">
      <g transform="translate(18 36)">
        <rect width="70" height="58" rx="6" fill="#22c55e" />
        <rect x="30" width="10" height="58" fill="#bbf7d0" />
        <rect y="22" width="70" height="10" fill="#bbf7d0" />
        <path d="M28 0c-10 0-16 8-10 14h16zM42 0c10 0 16 8 10 14H36z" fill="#86efac" />
      </g>
      <g transform="translate(78 18)">
        <rect width="78" height="70" rx="6" fill="#ef4444" />
        <rect x="34" width="12" height="70" fill="#fecaca" />
        <rect y="28" width="78" height="12" fill="#fecaca" />
        <path d="M32 0c-12 0-18 10-10 16h16zM48 0c12 0 18 10 10 16H42z" fill="#fda4af" />
      </g>
    </svg>
  );
}

export function DiscordHeroArt() {
  const pixels = [
    "00111111111100",
    "01111111111110",
    "11111111111111",
    "11111001100111",
    "11111001100111",
    "11111111111111",
    "11111111111111",
    "11110011110011",
    "11110011110011",
    "01111111111110",
    "00111111111100",
    "00011000001100",
  ];
  const size = 8;
  return (
    <svg className="depo-hero-art depo-pixel" viewBox="0 0 140 120" aria-hidden="true">
      <g transform="translate(14 8)">
        {pixels.flatMap((row, y) =>
          [...row].map((cell, x) =>
            cell === "1" ? <rect key={`${x}-${y}`} x={x * size} y={y * size} width={size} height={size} fill="#e9d5ff" /> : null,
          ),
        )}
      </g>
    </svg>
  );
}
