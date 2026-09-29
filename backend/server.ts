import Fastify from 'fastify';
import { WebSocketServer,WebSocket } from 'ws';
import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store';
import { act,tick,view } from './game';
import type { Room } from './types';

export async function createServer(options:{db?:string;clock?:()=>number;timers?:boolean}={}){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const store=new Store(options.db||process.env.TRACTOR_DB||path.join(root,'data/tractor.sqlite'));
  const rooms=new Map(store.rooms().map(r=>[r.code,r]));
  const app=Fastify({logger:false,bodyLimit:4096});const now=options.clock||Date.now;
  const sockets=new Map<WebSocket,{id:string;name:string;avatar:number}>();
  const connections=new Set<WebSocket>();
  const connected=()=>new Set([...sockets.values()].map(u=>u.id));
  const send=(ws:WebSocket,data:unknown)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1024*1024)ws.close(1013);else ws.send(JSON.stringify(data));}};
  const roomFor=(id:string)=>[...rooms.values()].find(r=>r.members.some(m=>m.id===id));
  function broadcast(room:Room){for(const [ws,u] of sockets)if(room.members.some(m=>m.id===u.id))send(ws,{type:'snapshot',room:view(room,u.id,connected()),serverTime:now()});}
  const rate=new Map<string,{n:number;time:number}>();
  app.post('/api/session',async(req,res)=>{
    const old=rate.get(req.ip),bucket=old&&now()-old.time<60000?old:{n:0,time:now()};rate.set(req.ip,bucket);
    if(++bucket.n>30)return res.code(429).send({error:'创建身份过于频繁，请稍后重试'});
    const body=req.body as any;const name=typeof body?.name==='string'?body.name.trim():'';
    if(!name||name.length>16)return res.code(400).send({error:'昵称需为 1–16 个字符'});
    return store.createUser(name);
  });
  app.get('/api/health',async()=>({ok:true,mode:'multiplayer'}));
  app.get('/api/profile',async(req,res)=>{
    const token=req.headers.authorization?.replace(/^Bearer /,'');const user=token&&store.user(token);
    if(!user)return res.code(401).send({error:'请先创建玩家资料'});return store.profile(user);
  });
  app.patch('/api/profile',async(req,res)=>{
    const token=req.headers.authorization?.replace(/^Bearer /,'');const user=token&&store.user(token);
    if(!user)return res.code(401).send({error:'请先创建玩家资料'});
    const body=req.body as any,name=typeof body?.name==='string'?body.name.trim():'',bio=typeof body?.bio==='string'?body.bio.trim():'';
    if(!name||name.length>16||bio.length>80||!Number.isInteger(body.avatar)||body.avatar<0||body.avatar>3)return res.code(400).send({error:'请检查昵称（1–16字）、签名（80字以内）和头像'});
    store.updateProfile(user.id,name,body.avatar,bio);
    for(const u of sockets.values())if(u.id===user.id){u.name=name;u.avatar=body.avatar;}
    for(const original of rooms.values())if(original.members.some(m=>m.id===user.id)){
      const room=structuredClone(original),member=room.members.find(m=>m.id===user.id)!;member.name=name;member.avatar=body.avatar;room.revision++;store.save(room,'profile');rooms.set(room.code,room);broadcast(room);
    }
    return store.profile({...user,name});
  });
  const files=new Set(['index.html','game.css','engine.js','app.js','music.js','game-audio.js','online.html','online.css','online.js','table-layout.js','card-art.js','card-art.css','offline-layout.css','lobby.html','profile.html','portal.css','portal.js','friends.html','friends.js','viewport.js','viewport.css']);
  app.get('/*',async(req,res)=>{
    let name:string;try{name=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'lobby.html';}catch{return res.code(400).send();}
    const asset=/^assets\/[a-zA-Z0-9_./-]+\.(png|jpg|webp|wav|mp3|js)$/.test(name);
    if(!files.has(name)&&!asset)return res.code(404).send();
    const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return res.code(403).send();
    try{const data=await readFile(file);return res.type(({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg'} as Record<string,string>)[path.extname(file)]||'application/octet-stream').send(data);}catch{return res.code(404).send();}
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:4096});
  app.server.on('upgrade',(req,socket,head)=>{
    const origin=req.headers.origin;
    if(req.url!=='/ws'||(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)){socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  });
  wss.on('connection',ws=>{
    connections.add(ws);let count=0,windowStart=now();let alive=true;
    const authTimer=setTimeout(()=>{if(!sockets.has(ws))ws.close(1008,'Authentication required');},5000);
    ws.on('pong',()=>{alive=true;});
    const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},30000);
    ws.on('message',raw=>{
      let id:unknown;
      try{
        if(now()-windowStart>1000){count=0;windowStart=now();}if(++count>30)throw Error('操作过于频繁');
        const message=JSON.parse(raw.toString());id=message.id;
        if(message.type==='auth'){
          if(typeof message.token!=='string'||message.token.length>128)throw Error('身份无效');
          const u=store.user(message.token);if(!u)throw Error('身份已失效，请重新登录');
          for(const [other,user] of sockets)if(user.id===u.id&&other!==ws){sockets.delete(other);other.close(4001,'已在其他页面连接');}
          sockets.set(ws,u);clearTimeout(authTimer);const r=roomFor(u.id);send(ws,{type:'authenticated',user:u,roomCode:r?.code||null});if(r)broadcast(r);return;
        }
        const user=sockets.get(ws);if(!user)throw Error('请先登录');
        if(message.type==='sync'){const room=roomFor(user.id);if(room)send(ws,{type:'snapshot',room:view(room,user.id,connected()),serverTime:now()});return;}
        if(typeof id!=='string'||!/^[\w-]{1,80}$/.test(id))throw Error('请求编号无效');
        const previous=store.result(user.id,id);if(previous){send(ws,previous);const r=roomFor(user.id);if(r)broadcast(r);return;}
        const existing=roomFor(user.id);let room:Room;
        if(message.type==='create'){
          if(existing)throw Error('请先离开当前房间');
          const settings=message.settings??{startLevel:2,turnSeconds:30,maxRounds:0};
          if(!settings||!Number.isInteger(settings.startLevel)||settings.startLevel<2||settings.startLevel>14||![15,30,60].includes(settings.turnSeconds)||![0,4,8,20].includes(settings.maxRounds))throw Error('房间设置无效');
          const rules={startLevel:settings.startLevel,turnSeconds:settings.turnSeconds,maxRounds:settings.maxRounds};
          let code;do{code=String(randomInt(100000,1000000));}while(rooms.has(code));
          room={settings:rules,code,revision:0,members:[{...user,ready:false}],levels:[rules.startLevel,rules.startLevel],dealer:0,round:1,game:null,updatedAt:now()};
        }else if(message.type==='join'){
          if(existing)throw Error('请先离开当前房间');
          const target=rooms.get(String(message.code));if(!target||target.members.length===0)throw Error('房间不存在');
          if(target.members.length===4||target.game)throw Error('房间已满或已经开局');room=structuredClone(target);room.members.push({...user,ready:false});
        }else{
          if(!existing)throw Error('请先创建或加入房间');room=structuredClone(existing);
          // Bids can race; validate against current authority. Plays require exact revision.
          if(!['bid','pass','ready'].includes(message.type)&&message.revision!==room.revision)throw Error('牌桌已经更新，请重新操作');
          const seat=room.members.findIndex(m=>m.id===user.id);
          if(message.type==='leave'){
            if(room.game&&room.game.phase!=='over')throw Error('牌局进行中，离线后会超时托管');
            room.members.splice(seat,1);room.members.forEach(m=>m.ready=false);
            // Seat changes start a fresh match, never reuse the previous partnership levels.
            room.game=null;room.levels=[room.settings?.startLevel||2,room.settings?.startLevel||2];room.dealer=0;room.round=1;
          }else act(room,seat,message.type,message,now());
        }
        room.revision++;room.updatedAt=now();const result={type:'ack',id,code:room.code,revision:room.revision};
        store.save(room,message.type,{user:user.id,id,result});rooms.set(room.code,room);send(ws,result);
        if(message.type==='leave')send(ws,{type:'left'});broadcast(room);
      }catch(error){send(ws,{type:'error',id,message:error instanceof Error?error.message:'操作失败'});const u=sockets.get(ws),r=u&&roomFor(u.id);if(r)send(ws,{type:'snapshot',room:view(r,u!.id,connected()),serverTime:now()});}
    });
    ws.on('error',()=>{});
    ws.on('close',()=>{clearTimeout(authTimer);clearInterval(heartbeat);connections.delete(ws);const u=sockets.get(ws);sockets.delete(ws);const r=u&&roomFor(u.id);if(r)broadcast(r);});
  });
  function advance(){for(const original of rooms.values()){
    if(!original.game||original.game.phase==='over'||original.game.deadline>now())continue;
    const room=structuredClone(original);
    try{if(tick(room,now())){room.revision++;room.updatedAt=now();store.save(room,'timer');rooms.set(room.code,room);broadcast(room);}}catch(error){app.log.error(error);}
  }}
  const timer=options.timers===false?null:setInterval(advance,50);
  app.addHook('onClose',async()=>{if(timer)clearInterval(timer);for(const ws of connections)ws.terminate();wss.close();store.close();});
  return {app,store,rooms,advance};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  void createServer().then(async({app})=>{
    await app.listen({port:Number(process.env.PORT||4173),host:process.env.HOST||'127.0.0.1'});
    console.log(`Tractor: ${app.listeningOrigin} · 联网入口 /online.html`);
    for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
  }).catch(error=>{console.error(error);process.exitCode=1;});
}
