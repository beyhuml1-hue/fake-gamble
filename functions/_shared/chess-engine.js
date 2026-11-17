import {Chess} from "chess.js";
export function newChess(){const chess=new Chess();return {fen:chess.fen(),moves:[],lastMove:null,check:false};}
export function moveChess(state,move){
 if(move?.type!=="chess"||typeof move.from!=="string"||typeof move.to!=="string"||!['q','r','b','n'].includes(move.promotion??'q'))return null;
 try{
  const chess=new Chess();for(const san of state.moves)chess.move(san);
  if(chess.fen()!==state.fen||chess.isGameOver())return null;
  const played=chess.move({from:move.from,to:move.to,promotion:move.promotion??'q'});if(!played)return null;
  const finished=chess.isGameOver();
  return {state:{fen:chess.fen(),moves:[...state.moves,played.san],lastMove:{from:played.from,to:played.to},check:chess.isCheck()},turn:chess.turn()==='w'?'host':'guest',finished,won:chess.isCheckmate(),reason:chess.isCheckmate()?'Checkmate.':chess.isStalemate()?'Stalemate; both stakes refunded.':chess.isThreefoldRepetition()?'Threefold repetition; both stakes refunded.':chess.isDraw()?'Draw; both stakes refunded.':chess.isCheck()?'Check.':played.san};
 }catch{return null;}
}
