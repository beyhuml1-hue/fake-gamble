export class ApiError extends Error {
 constructor(public status:number,message:string){super(message);this.name="ApiError";}
}
export function errorMessage(error:unknown,fallback="Something went wrong. Please try again."){
 if(error instanceof ApiError)return error.message;
 if(error instanceof DOMException&&error.name==="AbortError")return "The connection took too long. Your match is saved; try again.";
 if(error instanceof TypeError)return "Couldn't connect. Check your connection and try again.";
 return error instanceof Error&&!(error instanceof SyntaxError)?error.message:fallback;
}
export async function apiJSON<T>(url:string,options:RequestInit={}):Promise<T>{
 const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options,signal:controller.signal});
  const payload=await response.json().catch(()=>null) as T&{error?:string}|null;
  if(!response.ok){
   const fallback=response.status===401?"Your session ended. Sign in again to continue.":response.status===404?"This match is no longer available. Refresh the open matches.":response.status===429?"You're moving too quickly. Wait a moment and try again.":"The service is temporarily unavailable. Please try again shortly.";
   const message=payload?.error;
   throw new ApiError(response.status,message&&!/^(not found|internal server error)$/i.test(message)&&!/(migration|database|unexpected token)/i.test(message)?message:fallback);
  }
  if(!payload)throw new ApiError(502,"The server sent an incomplete response. Please try again.");
  return payload;
 }finally{window.clearTimeout(timeout);}
}
