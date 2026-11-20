import {useCallback,useEffect,useState} from "react";
import {useAuth} from "../components/AuthProvider";
import {formatUSD} from "../lib/money";
import {apiJSON,errorMessage} from "../lib/api";
import "./shop.css";

type Order={id:string;sku:string;playusdCents:number;creditsDelta:number;atMs:number};
type ShopStatus={walletCents:number;credits:number;adminBadge:boolean;orders:Order[];fictional:boolean;ok?:boolean};
const packs=[
 {sku:"small",name:"Starter",credits:100,cost:10000},
 {sku:"plus",name:"Plus",credits:300,cost:25000},
 {sku:"max",name:"Vault",credits:700,cost:50000}
] as const;

export function Shop(){
 const {isGuest,showSignIn,isAdmin}=useAuth();
 const [data,setData]=useState<ShopStatus|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const load=useCallback(async()=>{
  const result=await apiJSON<ShopStatus>("/api/auth/shop");
  setData(result);
 },[]);
 useEffect(()=>{
  if(isGuest)return;
  let active=true;
  void apiJSON<ShopStatus>("/api/auth/shop").then(result=>{if(active)setData(result);})
   .catch(err=>{if(active)setError(errorMessage(err,"Shop is temporarily unavailable."));});
  return()=>{active=false;};
 },[isGuest]);
 async function purchase(sku:string){
  if(busy)return;
  setBusy(sku);setError("");setNotice("");
  try{
   const result=await apiJSON<ShopStatus>("/api/auth/shop",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action:"buy",sku,id:crypto.randomUUID()})
   });
   setData(result);
   setNotice(sku==="admin-badge"?"Admin-style badge added to your profile.":"Shop credits added.");
   window.dispatchEvent(new Event("blockbet:wallet-sync"));
   void load().catch(()=>{});
  }catch(err){setError(errorMessage(err,"Purchase could not be completed."));}
  finally{setBusy(null);}
 }
 return <section className="shop-page">
  <div className="shop-heading"><div><p className="shop-eyebrow">BLOCKBET / STORE</p>
   <h1>Credit shop</h1><p>Exchange fictional Play USD for store credits and unlock an Admin-style profile badge.</p></div>
   <div className="shop-balance"><small>Your store credits</small><strong>{data?.credits.toLocaleString()??"—"}</strong></div>
  </div>
  <p className="shop-warning">Simulation only. Nothing here charges a card, has cash value, or gives owner permissions.</p>
  {isGuest?<div className="shop-login"><h2>Sign in to shop</h2>
    <p>Keep credits and badges saved to your BlockBet account.</p>
    <button className="bet-btn" onClick={showSignIn}>Sign in</button></div>:<>
  <div className="shop-wallet-bar"><span>Available Play USD <b>{data?formatUSD(data.walletCents):"…"}</b></span>
   <span>Shop credits <b>{data?.credits.toLocaleString()??"…"}</b></span>
   <span>Profile title <b>{data?.adminBadge?"Admin badge":"None"}</b></span></div>
  <h2>Get store credits</h2>
  <div className="shop-grid">{packs.map(pack=><article className="shop-product" key={pack.sku}>
   <span className="shop-product-icon" aria-hidden="true">✦</span>
   <span className="shop-tier">{pack.name}</span>
   <strong>{pack.credits.toLocaleString()} <small>credits</small></strong>
   <p>Exchange {formatUSD(pack.cost)} in fictional Play USD.</p>
   <button className="bet-btn" disabled={Boolean(busy)||!data||data.walletCents<pack.cost}
     onClick={()=>void purchase(pack.sku)}>{busy===pack.sku?"Exchanging…":"Get credits"}</button>
  </article>)}</div>
  <h2>Profile upgrades</h2>
  <article className="shop-upgrade">
   <div className="shop-admin-icon" aria-hidden="true">A</div>
   <div><small className="shop-tier">PROFILE CUSTOMISATION</small><h3>Admin-style badge</h3>
    <p>A cosmetic profile title only. No moderation tools, balance controls, bans, or owner access.</p></div>
   <div className="shop-upgrade-action"><strong>{data?.adminBadge?"Owned":"700 credits"}</strong>
    <button className="bet-btn" disabled={Boolean(busy)||!data||data.adminBadge||data.credits<700}
     onClick={()=>void purchase("admin-badge")}>{data?.adminBadge?"Purchased":busy==="admin-badge"?"Applying…":"Unlock badge"}</button></div>
  </article>
  {isAdmin&&<p className="shop-owner-note">Your real owner/admin controls remain on the secured /admin page.</p>}
  {data?.orders.length?<><h2>Recent shop activity</h2><div className="shop-history">
   {data.orders.map(order=><div key={order.id}><span>{order.sku==="admin-badge"?"Admin badge":order.sku+" credit pack"}</span>
   <span>{new Date(order.atMs).toLocaleDateString()}</span>
   <strong>{order.creditsDelta>0?"+":""}{order.creditsDelta} credits</strong></div>)}</div></>:null}
  </>}
  {error&&<p role="alert" className="neg">{error}</p>}
  {notice&&<p role="status" className="pos">{notice}</p>}
 </section>;
}
