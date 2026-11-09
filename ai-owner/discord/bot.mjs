// Discord Gateway bridge for the isolated BlockBet AI Owner staging Worker.
// Requires discord.js and privileged Message Content intent enabled in Discord Developer Portal.
// Never ships Discord or NanoGPT credentials to browser code.
import "dotenv/config";
import {Client,GatewayIntentBits,Events} from "discord.js";

const required=["DISCORD_BOT_TOKEN","DISCORD_GUILD_ID","DISCORD_BRIDGE_SECRET","AI_OWNER_API_URL"];
for(const key of required)if(!process.env[key])throw Error("Missing configuration: "+key);
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const lastMessageAt=new Map();
client.once(Events.ClientReady,ready=>{console.log("BlockBet AI Owner Discord staging bot ready: "+ready.user.username);});
client.on(Events.MessageCreate,async message=>{
 if(message.author.bot||!message.guild||message.guild.id!==process.env.DISCORD_GUILD_ID)return;
 if(!message.mentions.has(client.user)&&!/(^|\s)@ai\b/i.test(message.content))return;
 const now=Date.now(),prev=lastMessageAt.get(message.author.id)||0;
 if(now-prev<3500)return;
 lastMessageAt.set(message.author.id,now);
 const mention=client.user?"<@"+client.user.id+">":"";
 const content=message.content.replaceAll(mention,"").replace(/(^|\s)@ai\b/gi," ").trim().slice(0,800);
 if(!content)return;
 try{
  await message.channel.sendTyping();
  const response=await fetch(process.env.AI_OWNER_API_URL+"/discord/bridge",{
   method:"POST",headers:{"Content-Type":"application/json","x-discord-bridge":process.env.DISCORD_BRIDGE_SECRET},
   body:JSON.stringify({guildId:message.guild.id,userId:message.author.id,handle:message.author.username,message:content}),
   signal:AbortSignal.timeout(27000)
  });
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"AI Owner unavailable.");
  // Prevent pinging roles or other people through model output.
  const reply=String(data.reply||"No reply.").slice(0,1800);
  await message.reply({content:reply,allowedMentions:{parse:[],repliedUser:false}});
 }catch(e){
  await message.reply({content:"AI Owner is taking five. Try again shortly.",allowedMentions:{parse:[],repliedUser:false}});
 }
});
client.on(Events.Error,()=>console.warn("Discord gateway error"));
// The Discord process doubles as a schedule driver when Cloudflare's free
// account has no spare Cron Trigger slots. The Worker enforces idempotency.
let lastScheduleBucket=-1;
async function driveSchedule(){
 const current=new Date(),bucket=Math.floor(current.getTime()/300000);
 if(bucket===lastScheduleBucket||current.getUTCMinutes()%5!==0)return;
 lastScheduleBucket=bucket;
 const kinds=["hourly"];
 if(current.getUTCHours()>=8)kinds.push("daily");
 for(const kind of kinds){
  try{
   const response=await fetch(process.env.AI_OWNER_API_URL+"/internal/scheduler",{
    method:"POST",
    headers:{"content-type":"application/json","x-discord-bridge":process.env.DISCORD_BRIDGE_SECRET},
    body:JSON.stringify({kind}),
    signal:AbortSignal.timeout(18000)
   });
   if(!response.ok)console.warn("Staging scheduler "+kind+" returned HTTP "+response.status);
  }catch{console.warn("Staging scheduler "+kind+" unreachable");}
 }
}
setInterval(()=>void driveSchedule(),30000);
void driveSchedule();
await client.login(process.env.DISCORD_BOT_TOKEN);
