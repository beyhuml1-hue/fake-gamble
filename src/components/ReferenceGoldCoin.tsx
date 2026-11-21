type ReferenceGoldCoinProps={degrees:number;spinning:boolean};
// Adapted from the user-supplied Uiverse.io coin by JohnnyCSilva.
// Keep the thick edge and opposing faces; game state controls the final side.
export function ReferenceGoldCoin({degrees,spinning}:ReferenceGoldCoinProps){
 return <div className={spinning?'uiverse-coin-scene is-flipping':'uiverse-coin-scene'} role="img" aria-label={spinning?'Coin flipping':`Coin showing ${Math.round(degrees/180)%2===0?'heads':'tails'}`}>
  <div className="uiverse-coin" style={{transform:`rotateY(${degrees+90}deg)`}}>
   <div className="side heads" aria-hidden="true"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="99" fill="#F7931A"/><circle cx="100" cy="100" r="88" fill="none" stroke="#ffc978" strokeWidth="2"/><text x="100" y="126" textAnchor="middle" fill="white" fontFamily="Arial,sans-serif" fontSize="78" fontWeight="600">H</text></svg></div>
   <div className="side tails" aria-hidden="true"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="99" fill="#2468bc"/><circle cx="100" cy="100" r="88" fill="none" stroke="#9ccaff" strokeWidth="2"/><text x="100" y="126" textAnchor="middle" fill="white" fontFamily="Arial,sans-serif" fontSize="78" fontWeight="600">T</text></svg></div>
  </div>
 </div>;
}
