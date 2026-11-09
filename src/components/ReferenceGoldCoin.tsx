type ReferenceGoldCoinProps = {
  degrees: number;
  spinning: boolean;
};

/**
 * Uses the *original BlockBet Flip cover artwork*, not a newly designed coin.
 * The same photographic gold face is shown on both sides, with simple
 * embossed HEADS/TAILS labels; CSS perspective provides the flip animation.
 * It works without a CDN, WebGL, or a 3D model download.
 */
export function ReferenceGoldCoin({ degrees, spinning }: ReferenceGoldCoinProps) {
  return (
    <div
      className={spinning ? "reference-coin-scene is-flipping" : "reference-coin-scene"}
      role="img"
      aria-label={spinning ? "Gold coin flipping" : `Gold coin showing ${Math.round(degrees / 180) % 2 === 0 ? "heads" : "tails"}`}
    >
      <div className="reference-coin-body" style={{ transform: `rotateY(${degrees}deg)` }}>
        <div className="reference-coin-face reference-coin-heads" aria-hidden="true">
          <span>HEADS</span>
        </div>
        <div className="reference-coin-face reference-coin-tails" aria-hidden="true">
          <span>TAILS</span>
        </div>
      </div>
    </div>
  );
}
