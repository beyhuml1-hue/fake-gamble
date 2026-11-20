export type RoundSummary={id:string;returned:number;net:number;multiplier:number;outcome:'profit'|'even'|'loss'};
export function summarizeRound(value:unknown,game:string):RoundSummary|null;
