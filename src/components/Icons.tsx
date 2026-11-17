import type { ReactNode } from "react";

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CoinMark({ size = 16 }: { size?: number }) {
  return (
    <svg className="coin-mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#f5c542" />
      <circle cx="12" cy="12" r="6.2" fill="none" stroke="#8a6a12" strokeWidth="1.4" />
      <path d="M12 7.6v8.8M9.6 9.4c.8-.9 4-.9 4.8 0M9.6 14.6c.8.9 4 .9 4.8 0" fill="none" stroke="#8a6a12" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    dice: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="9" cy="9" r="1" fill="currentColor" />
        <circle cx="15" cy="15" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </>
    ),
    mines: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.2 7.2l1.4 1.4M15.4 15.4l1.4 1.4M16.8 7.2l-1.4 1.4M8.6 15.4l-1.4 1.4" />
      </>
    ),
    "mines-battles": (
      <><path d="M3 7l6 12M9 7L3 19M15 7l6 12M21 7l-6 12" /><path d="M7 5l3 2M17 5l-3 2" /><path d="M12 9l3 3-3 3-3-3z" /></>
    ),
    plinko: (
      <>
        <circle cx="12" cy="4" r="1.4" fill="currentColor" />
        <circle cx="8" cy="9" r="1" fill="currentColor" />
        <circle cx="12" cy="9" r="1" fill="currentColor" />
        <circle cx="16" cy="9" r="1" fill="currentColor" />
        <circle cx="6" cy="14" r="1" fill="currentColor" />
        <circle cx="10" cy="14" r="1" fill="currentColor" />
        <circle cx="14" cy="14" r="1" fill="currentColor" />
        <circle cx="18" cy="14" r="1" fill="currentColor" />
        <path d="M7 19h2M11 19h2M15 19h2" />
      </>
    ),
    crash: <path d="M4 16c4-1 5-8 8-8s3 6 8 4" />,
    limbo: (
      <>
        <path d="M4 16h16" />
        <path d="M6 16V8l6 4 6-6" />
      </>
    ),
    keno: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    wheel: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 4v6M12 14v6M4 12h6M14 12h6" />
      </>
    ),
    hilo: <path d="M8 8l4-4 4 4M8 16l4 4 4-4" />,
    blackjack: (
      <>
        <rect x="6" y="3" width="10" height="14" rx="1.5" />
        <rect x="9" y="7" width="10" height="14" rx="1.5" />
      </>
    ),
    roulette: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="5" r="1" fill="currentColor" />
      </>
    ),
    dragon: (
      <>
        <rect x="4" y="15" width="16" height="5" rx="1" />
        <rect x="6" y="10" width="12" height="4" rx="1" />
        <rect x="8" y="5" width="8" height="4" rx="1" />
        <circle cx="12" cy="3" r="1.2" fill="currentColor" />
      </>
    ),
    flip: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8M9 10c1.5-1 4.5-1 6 0" />
      </>
    ),
    diamonds: <path d="M12 3l7 8-7 10L5 11l7-8z" />,
    baccarat: (
      <>
        <rect x="3" y="5" width="10" height="14" rx="1.4" />
        <rect x="11" y="5" width="10" height="14" rx="1.4" />
      </>
    ),
    pump: (
      <>
        <path d="M12 20c-4 0-6-3-6-7a6 6 0 1 1 12 0c0 4-2 7-6 7z" />
        <path d="M12 4v3" />
      </>
    ),
    cases: (
      <>
        <rect x="3" y="8" width="18" height="12" rx="2" />
        <path d="M3 12h18M10 12v3h4v-3" />
      </>
    ),
    upgrader: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 12l5-2" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      </>
    ),
    chicken: (
      <>
        <circle cx="12" cy="12" r="5" />
        <path d="M16 10l3-1M9 16l-1 3M15 16l1 3M10 8l1-3" />
      </>
    ),
    darts: (
      <>
        <circle cx="12" cy="13" r="6" />
        <circle cx="12" cy="13" r="2" />
        <path d="M12 3v5" />
      </>
    ),
    casino: (
      <>
        <path d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    phone: (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </>
    ),
    stats: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 15v-4" />
        <path d="M12 15V8" />
        <path d="M16 15v-6" />
      </>
    ),
    packs: (
      <>
        <rect x="4" y="7" width="16" height="12" rx="2" />
        <path d="M4 11h16M12 7v12" />
      </>
    ),
    "case-battles": (
      <>
        <rect x="3" y="8" width="8" height="9" rx="1.4" />
        <rect x="13" y="8" width="8" height="9" rx="1.4" />
        <path d="M11 12h2" />
      </>
    ),
    coinflip: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M9 12h6" />
      </>
    ),
    uno: (
      <>
        <rect x="5" y="4" width="10" height="14" rx="1.5" />
        <path d="M9 11h2" />
      </>
    ),
    "connect-four": (
      <>
        <circle cx="8" cy="9" r="2" />
        <circle cx="16" cy="9" r="2" />
        <circle cx="8" cy="15" r="2" />
        <circle cx="16" cy="15" r="2" />
      </>
    ),
    poker: (
      <>
        <rect x="7" y="3" width="10" height="14" rx="1.4" />
        <path d="M12 8v4" />
      </>
    ),
    pool: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </>
    ),
    chess: (
      <>
        <path d="M8 19h8M9 19l1-6h4l1 6" />
        <circle cx="12" cy="8" r="2.2" />
      </>
    ),
    "floor-is-lava": (
      <>
        <path d="M4 16c2-3 4-3 6 0s4 3 6 0 4-3 4 0" />
        <path d="M8 10h8" />
      </>
    ),
    draw: (
      <>
        <rect x="6" y="4" width="12" height="16" rx="1.5" />
        <path d="M9 9h6M9 13h4" />
      </>
    ),
    rps: (
      <>
        <circle cx="8" cy="12" r="3" />
        <path d="M13 9h5l-2 3h2l-5 6" />
      </>
    ),
    double: (
      <>
        <circle cx="8" cy="12" r="4" />
        <circle cx="16" cy="12" r="4" />
      </>
    ),
    "pig-race": (
      <>
        <path d="M4 16h16" />
        <path d="M6 16l2-6h3l2 6M14 16l2-8h2" />
      </>
    ),
    stocks: (
      <>
        <path d="M4 16l4-5 3 3 6-7" />
        <path d="M14 7h4v4" />
      </>
    ),
    slide: (
      <>
        <path d="M4 16h16" />
        <circle cx="15" cy="16" r="2" fill="currentColor" />
      </>
    ),
    blitz: (
      <>
        <path d="M13 3L6 13h5l-1 8 8-12h-5l0-6z" />
      </>
    ),
    snakes: (
      <>
        <path d="M7 16c0-6 10-2 10-8" />
        <circle cx="17" cy="7" r="1.2" fill="currentColor" />
      </>
    ),
  };

  return (
    <svg {...common} aria-hidden="true">
      {paths[name] ?? paths.dice}
    </svg>
  );
}
