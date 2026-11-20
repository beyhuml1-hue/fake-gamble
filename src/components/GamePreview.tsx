import type {GameId} from '../data/games';

// Small views of actual game mechanics, rather than payout promises or badges.
export function GamePreview({game}:{game:GameId}){
 const cards=['blackjack','hilo','baccarat','poker','draw','blitz'].includes(game);
 const grid=['mines','mines-battles','dragon','keno','diamonds'].includes(game);
 if(game==='cases')return <span className="game-preview pack-preview" aria-hidden="true"><img src="/cards/rift/0-4.svg" alt=""/><img src="/cards/rift/1-2.svg" alt=""/><img src="/cards/rift/36.svg" alt=""/></span>;
 if(cards)return <span className="game-preview table-preview" aria-hidden="true"><span className="preview-playing-card"><b>A</b><i>♠</i></span><span className="preview-playing-card red"><b>K</b><i>♥</i></span><span className="preview-table-line"/></span>;
 if(grid)return <span className={`game-preview grid-preview ${game}`} aria-hidden="true"><span className="preview-grid">{Array.from({length:12},(_,i)=><span key={i} className={i===5||i===10?'open':''}>{i===5||i===10?<svg viewBox="0 0 32 32"><path d="m16 3 12 10-12 16L4 13Z"/><path d="m4 13 12 5 12-5M16 3v26"/></svg>:game==='keno'?i+1:null}</span>)}</span></span>;
 if(game==='dice')return <span className="game-preview dice-preview" aria-hidden="true"><span className="preview-die"><i/><i/><i/><i/><i/></span><span className="preview-roll-line"><span/></span><span className="preview-roll-labels"><small>0</small><small>50</small><small>100</small></span></span>;
 if(game==='plinko')return <span className="game-preview plinko-preview" aria-hidden="true"><svg viewBox="0 0 280 180"><path className="preview-ball-path" d="m140 20-15 22 26 24-28 24 28 24-20 24"/>{Array.from({length:6},(_,r)=>Array.from({length:r+3},(_,c)=><circle key={`${r}-${c}`} cx={140-(r+2)*12+c*24} cy={35+r*22} r="3"/>))}<circle className="preview-ball" cx="140" cy="18" r="7"/>{Array.from({length:8},(_,i)=><rect key={i} className={i===3?'selected':''} x={44+i*24} y="164" width="20" height="9" rx="2"/>)}</svg></span>;
 if(['crash','limbo','stocks','slide'].includes(game))return <span className="game-preview curve-preview" aria-hidden="true"><svg viewBox="0 0 280 180"><path className="preview-chart-grid" d="M30 35h225M30 85h225M30 135h225M80 20v135M140 20v135M200 20v135"/><path className="preview-curve" d="M30 148C90 148 126 126 151 99S198 55 247 24"/><circle cx="247" cy="24" r="5"/></svg></span>;
 return <span className="game-preview artwork-preview" aria-hidden="true"><span className="arcade-art" data-game={game}/></span>;
}
