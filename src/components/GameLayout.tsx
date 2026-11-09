import { useEffect, type ReactNode } from "react";

export function GameLayout({
  title,
  note,
  panel,
  children,
}: {
  title: string;
  note: string;
  panel: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · BlockBet`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <section className="game-page">
      <div className="game-card">
        <div className="game-panel">
          <div className="panel-head">
            <h1>{title}</h1>
            <span>{note}</span>
          </div>
          {panel}
        </div>
        <div className="game-stage">{children}</div>
        <p className="game-meta">Play USD</p>
      </div>
    </section>
  );
}
