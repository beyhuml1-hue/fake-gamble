/** Render chat as plain text. Tags are stripped so markup cannot run. */
export function sanitizeChat(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

export function maskName(name: string): string {
  const clean = name.replace(/[^a-z0-9]/gi, "") || "Player";
  if (clean.length <= 2) return clean.slice(0, 1) + "***";
  return clean.slice(0, 2) + "***" + clean.slice(-1);
}

export const RANKS = ["BRONZE", "SILVER", "GOLD", "DIAMOND"] as const;
export type Rank = (typeof RANKS)[number];

export function rankFor(name: string): Rank {
  const n = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return RANKS[n % RANKS.length]!;
}
