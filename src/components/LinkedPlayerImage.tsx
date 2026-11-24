import { useEffect, useState, type ReactNode } from "react";

export function LinkedPlayerImage({ player, view, className, fallback = null }: {
  player: string;
  view: "avatar" | "body";
  className?: string;
  fallback?: ReactNode;
}) {
  const [id, setId] = useState(player.startsWith(".") ? "" : player);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!/^\.[A-Za-z0-9_]{1,16}$/.test(player)) return;
    const controller = new AbortController();
    const gamertag = player.slice(1).replaceAll("_", " ");
    fetch(`https://api.geysermc.org/v2/xbox/xuid/${encodeURIComponent(gamertag)}`,
      { signal: controller.signal, referrerPolicy: "no-referrer" })
      .then(response => response.ok ? response.json() : null)
      .then(profile => {
        if (typeof profile?.xuid !== "string" || !/^\d{1,20}$/.test(profile.xuid)) return;
        const hex = BigInt(profile.xuid).toString(16).padStart(16, "0");
        if (hex.length === 16) setId(`00000000-0000-0000-${hex.slice(0, 4)}-${hex.slice(4)}`);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [player]);
  if (!id || failed) return fallback;
  return <img className={className} src={`https://mc-heads.net/${view}/${encodeURIComponent(id)}`}
    alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
