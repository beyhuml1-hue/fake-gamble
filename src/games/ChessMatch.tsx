import {useEffect,useMemo,useState} from "react";
import {Chess,type Square} from "chess.js";
import {sound} from "../lib/sound";
type Move={type:"chess";from:string;to:string;promotion:string};
type Props={fen:string;moves:string[];lastMove?:{from:string;to:string}|null;role:"host"|"guest"|null;myTurn:boolean;busy:boolean;onMove:(move:Move)=>void};
const symbols:Record<string,string>={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
export function ChessMatch({fen,moves,lastMove,role,myTurn,busy,onMove}:Props){
 const chess=useMemo(()=>new Chess(fen),[fen]);const [selected,setSelected]=useState<Square|null>(null);
 const [promotion,setPromotion]=useState<{from:Square;to:Square}|null>(null);
 const legal=selected?chess.moves({square:selected,verbose:true}):[];
 const files=role==="guest"?"hgfedcba":"abcdefgh",ranks=role==="guest"?"12345678":"87654321";
 useEffect(()=>{setSelected(null);setPromotion(null);},[fen]);
 function pick(square:Square){
  if(!myTurn||busy||promotion)return;
  const move=legal.find(m=>m.to===square);
  if(selected&&move){sound.tick();if(move.flags.includes('p'))setPromotion({from:selected,to:square});else onMove({type:"chess",from:selected,to:square,promotion:"q"});return;}
  const piece=chess.get(square);setSelected(piece?.color===(role==="host"?"w":"b")?square:null);sound.tick();
 }
 return <div className="shared-chess">
  <div className="chess-status"><span>{role==="host"?"You play White":"You play Black"}</span><b>{chess.isCheckmate()?"Checkmate":chess.isDraw()?"Draw":chess.isCheck()?"Check - protect your king":myTurn?"Your move":"Opponent's move"}</b></div>
  <div className="shared-chess-board" role="group" aria-label="Multiplayer chess board">
   {[...ranks].flatMap(rank=>[...files].map(file=>{
    const square=(file+rank) as Square,piece=chess.get(square),target=legal.some(m=>m.to===square),light=(file.charCodeAt(0)-97+Number(rank))%2===0;
    return <button type="button" key={square} className={"shared-square"+(light?" light":" dark")+(selected===square?" selected":"")+(target?" legal":"")+(lastMove?.from===square||lastMove?.to===square?" last-move":"")}
      disabled={!myTurn||busy||!!promotion} aria-label={square+(piece?" "+(piece.color==="w"?"White":"Black")+" "+({k:"king",q:"queen",r:"rook",b:"bishop",n:"knight",p:"pawn"}[piece.type]):" empty")+(target?", legal move":"")} aria-pressed={selected===square} onClick={()=>pick(square)}>
     <small>{square}</small>{piece&&<span key={piece.color+piece.type+square} className={"chess-piece "+(piece.color==="w"?"white":"black")}>{symbols[piece.color+piece.type]}</span>}{target&&!piece&&<i/>}
    </button>;
   }))}
  </div>
  {promotion&&<div className="chess-promotion" role="group" aria-label="Choose promotion"><b>Promote your pawn</b>{["q","r","b","n"].map(type=><button type="button" key={type} disabled={busy} onClick={()=>onMove({type:"chess",...promotion,promotion:type})}>{symbols[(role==="host"?"w":"b")+type]}</button>)}</div>}
  <div className="chess-move-list" aria-label="Move history">{moves.length?moves.map((move,i)=><span key={i}>{i%2===0?<small>{Math.floor(i/2)+1}.</small>:null}{move}</span>):<span>Select a piece to see its legal moves.</span>}</div>
 </div>;
}
