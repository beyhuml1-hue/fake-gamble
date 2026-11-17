import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL('../src/lib/api.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {apiJSON,errorMessage}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test("API failures show useful retry messages rather than HTML/parser or database details",async()=>{
 const priorFetch=globalThis.fetch,priorWindow=globalThis.window;
 globalThis.window={setTimeout,clearTimeout};
 try{
  globalThis.fetch=async()=>new Response('<h1>Not found</h1>',{status:404});
  await assert.rejects(()=>apiJSON('/test'),error=>error.status===404&&!/Unexpected token|<h1>/.test(error.message)&&/Refresh/.test(error.message));
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'Apply migration 0013. Database error.'}),{status:503});
  await assert.rejects(()=>apiJSON('/test'),error=>/temporarily unavailable/.test(error.message));
  globalThis.fetch=async()=>new Response(JSON.stringify({error:'That move is not allowed.'}),{status:422});
  await assert.rejects(()=>apiJSON('/test'),error=>error.message==='That move is not allowed.');
  assert.match(errorMessage(new TypeError('Failed to fetch')),/Check your connection/);
  assert.match(errorMessage(new DOMException('aborted','AbortError')),/took too long/);
 }finally{globalThis.fetch=priorFetch;globalThis.window=priorWindow;}
});
