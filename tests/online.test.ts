import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createServer} from '../backend/server';
import {act,start,tick,view,E} from '../backend/game';
import type {Room} from '../backend/types';
function room():Room{return {code:'123456',revision:0,members:[0,1,2,3].map(i=>({id:String(i),name:'玩家'+i,ready:false})),levels:[2,2],dealer:0,round:1,game:null,updatedAt:0};}
test('authority: all phases, card conservation, privacy, turn validation and a full match',()=>{
  for(let seed=0;seed<8;seed++){
    const r=room();start(r,0);let n=0;
    while(r.game!.phase!=='over'&&n++<1500){
      const g=r.game!;
      if(g.phase==='bidding'){
        const seat=2,option=E.bidOptions(g.hands[seat],g.level,g.currentBid,seat)[0];
        if(option)act(r,seat,'bid',{choice:option.choice},g.deadline-1);
      }
      if(g.phase==='playing'){
        assert.throws(()=>act(r,(g.turn+1)%4,'play',{cards:[g.hands[(g.turn+1)%4][0]?.id]},0),/尚未轮到你/);
        assert.throws(()=>act(r,g.turn,'play',{cards:['fake']},0),/不在手中/);
      }
      for(let p=0;p<4;p++){
        const v=view(r,String(p),new Set());assert.equal('hands' in v.game!,false);assert.equal('deck' in v.game!,false);assert.equal('pending' in v.game!,false);
        assert.deepEqual(new Set(v.game!.hand.map((c:any)=>c.id)),new Set(g.hands[p].map(c=>c.id)));
        if(p!==g.dealer&&g.phase!=='over')assert.equal(v.game!.bottom.length,0);
      }
      tick(r,g.deadline);
      const ids=[...g.hands.flat(),...g.publicCards,...g.deck.slice(g.dealIndex),...(g.phase==='bury'?[]:g.bottom),...(g.phase==='throwing'?g.plays[0].cards:[])].map(c=>c.id);
      assert.equal(ids.length,108);assert.equal(new Set(ids).size,108);
    }
    assert.equal(r.game!.phase,'over');assert.equal(r.game!.publicCards.length,100);assert.equal(view(r,'1',new Set()).game!.bottom.length,8);
  }
});
test('first round final bidder takes dealer; subsequent rounds rotate; A ends match',()=>{
  const r=room();start(r,0);while(r.game!.phase==='dealing')tick(r,r.game!.deadline);
  const g=r.game!,bidder=g.hands.findIndex(h=>h.some(c=>c.r===2)),s=g.hands[bidder].find(c=>c.r===2)!.s;
  act(r,bidder,'bid',{choice:s+'1'},g.deadline-1);tick(r,g.deadline);assert.equal(g.dealer,bidder);
  r.game!.phase='over';r.dealer=3;start(r,0);while(r.game!.phase==='dealing')tick(r,r.game!.deadline);
  const next=r.game!,p=next.hands.findIndex(h=>h.some(c=>c.r===2));act(r,p,'bid',{choice:next.hands[p].find(c=>c.r===2)!.s+'1'},next.deadline-1);tick(r,next.deadline);assert.equal(next.dealer,3);
  next.phase='over';next.matchOver=true;r.levels=[14,12];start(r,0);assert.deepEqual(r.levels,[2,2]);assert.equal(r.round,1);
});
test('failed throws display all cards then return extras; only a one-card hand auto plays early',()=>{
  const r=room();start(r,0);const g=r.game!;
  const c=(s:string,r:number,id:string)=>({s,r,id});
  g.phase='playing';g.trump='H';g.turn=0;g.deadline=30000;
  g.hands=[[c('S',14,'a'),c('S',9,'b'),c('S',13,'c'),c('S',13,'d')],[c('S',4,'e')],[c('S',10,'f')],[c('S',3,'g')]];
  const selected=g.hands[0].map(c=>c.id);act(r,0,'play',{cards:selected},1000);
  assert.equal(g.phase,'throwing');assert.equal(g.plays[0].cards.length,4);assert.equal(g.hands[0].length,0);assert.equal(g.publicCards.length,0);
  assert.equal(tick(r,2199),false);tick(r,2200);assert.equal(g.phase,'playing');assert.equal(g.plays[0].cards.length,1);assert.equal(g.plays[0].cards[0].id,'b');assert.equal(g.hands[0].length,3);assert.equal(g.turn,3);assert.equal(g.deadline,2850);
  assert.equal(tick(r,2849),false);tick(r,2850);assert.equal(g.hands[3].length,0);
  // Two cards can be a forced follow, but must still wait for the regular timeout.
  const r2=room();start(r2,0);const g2=r2.game!;g2.phase='playing';g2.trump='H';g2.turn=0;g2.hands=[[c('S',3,'x')],[c('C',8,'y')],[c('C',9,'z')],[c('S',4,'q'),c('S',5,'w')]];
  act(r2,0,'play',{cards:['x']},1000);assert.equal(g2.deadline,31000);assert.equal(tick(r2,1650),false);
});
test('pass locks all further declarations for this game, including self-reinforcement, and resets next game',()=>{
  const r=room();start(r,0);const g=r.game!;g.phase='bidding';
  g.hands[0]=[{id:'s1',s:'S',r:2},{id:'s2',s:'S',r:2},{id:'j1',s:'J',r:16},{id:'j2',s:'J',r:16}];
  g.hands[1]=[{id:'h1',s:'H',r:2},{id:'h2',s:'H',r:2}];
  act(r,0,'bid',{choice:'S1'},0);act(r,0,'pass',{},1);
  for(const choice of ['S2','BJ'])assert.throws(()=>act(r,0,'bid',{choice},2),/本局已选择不叫/);
  assert.equal(view(r,'0',new Set()).game!.passed[0],true);act(r,1,'bid',{choice:'H2'},3);assert.equal(g.currentBid?.player,1);
  g.phase='over';start(r,4);assert.equal(view(r,'0',new Set()).game!.passed[0],false);
});
class Client {
  ws:WebSocket; messages:any[]=[];
  constructor(url:string){this.ws=new WebSocket(url);this.ws.on('message',m=>this.messages.push(JSON.parse(m.toString())));}
  async wait(predicate:(m:any)=>boolean){const until=Date.now()+5000;while(Date.now()<until){const i=this.messages.findIndex(predicate);if(i>=0)return this.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error('Timed out');}
  async open(){if(this.ws.readyState!==WebSocket.OPEN)await new Promise<void>(r=>this.ws.once('open',()=>r()));}
  send(m:any){this.ws.send(JSON.stringify(m));}
}
test('four real sockets: room join, duplicate ready, private snapshots, reconnect, durable restart, static isolation',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'tractor-')),db=path.join(dir,'game.db');let clock=1000;
  let server=await createServer({db,clock:()=>clock,timers:false});await server.app.listen({port:0,host:'127.0.0.1'});
  const users:any[]=[],clients:Client[]=[];
  try{
    for(let p=0;p<4;p++){
      const response=await server.app.inject({method:'POST',url:'/api/session',payload:{name:'牌友'+p}});const user=response.json();users.push(user);
      const client=new Client(server.app.listeningOrigin.replace('http:','ws:')+'/ws');clients.push(client);await client.open();client.send({type:'auth',token:user.token});await client.wait(m=>m.type==='authenticated');
    }
    clients[0].send({type:'create',id:'create'});const created=await clients[0].wait(m=>m.type==='ack');
    for(let p=1;p<4;p++){clients[p].send({type:'join',id:'join',code:created.code});await clients[p].wait(m=>m.type==='ack');}
    for(let p=0;p<4;p++){clients[p].send({type:'ready',id:'ready'});await clients[p].wait(m=>m.type==='ack');}
    const r=server.rooms.get(created.code)!;assert.equal(r.game!.phase,'dealing');const rev=r.revision;
    clients[3].send({type:'ready',id:'ready'});await clients[3].wait(m=>m.type==='ack');assert.equal(server.rooms.get(created.code)!.revision,rev);
    for(let i=0;i<100;i++){clock+=100;server.advance();}
    clients[0].send({type:'sync'});const snapshot=await clients[0].wait(m=>m.type==='snapshot'&&m.room.game?.phase==='bidding');assert.equal(snapshot.room.game.hand.length,25);assert.equal(snapshot.room.game.hands,undefined);assert.equal(snapshot.room.game.bottom.length,0);
    clients[1].send({type:'play',id:'bad',revision:server.rooms.get(created.code)!.revision,cards:['fake']});await clients[1].wait(m=>m.type==='error'&&m.id==='bad');
    for(const url of ['/.git/config','/backend/store.ts','/data/tractor.sqlite','/package.json'])assert.equal((await server.app.inject({url})).statusCode,404);
    clients[0].send({type:'pass',id:'pass'});await clients[0].wait(m=>m.type==='ack'&&m.id==='pass');
    clients[0].send({type:'bid',id:'after-pass',choice:'S1'});const rejected=await clients[0].wait(m=>m.type==='error'&&m.id==='after-pass');assert.match(rejected.message,/已选择不叫/);
    const before=structuredClone(server.rooms.get(created.code));clients.forEach(c=>c.ws.terminate());await server.app.close();
    server=await createServer({db,clock:()=>clock,timers:false});await server.app.listen({port:0,host:'127.0.0.1'});assert.deepEqual(server.rooms.get(created.code),before);
    const reconnect=new Client(server.app.listeningOrigin.replace('http:','ws:')+'/ws');clients.push(reconnect);await reconnect.open();reconnect.send({type:'auth',token:users[0].token});const restored=await reconnect.wait(m=>m.type==='snapshot');assert.equal(restored.room.code,created.code);assert.deepEqual(restored.room.game.hand,snapshot.room.game.hand);
    assert.equal(restored.room.game.passed[0],true);
    reconnect.send({type:'create',id:'create'});const duplicate=await reconnect.wait(m=>m.type==='ack');assert.equal(duplicate.code,created.code);assert.equal(server.rooms.size,1);
  }finally{clients.forEach(c=>c.ws.terminate());await server.app.close();rmSync(dir,{recursive:true,force:true});}
});

test('room settings control turn deadlines, round limit and next-match starting level',()=>{
 const r=room();r.settings={startLevel:6,turnSeconds:60,maxRounds:4};r.levels=[6,6];r.round=4;start(r,0);assert.equal(r.game!.level,6);assert.equal(r.game!.turnMs,60000);
 let n=0;while(r.game!.phase!=='over'&&n++<1500){const now=r.game!.deadline;tick(r,now);if(r.game!.phase==='bury')assert.equal(r.game!.deadline-now,60000);}
 assert.equal(r.game!.phase,'over');assert.equal(r.game!.matchOver,true);start(r,r.game!.deadline);assert.deepEqual(r.levels,[6,6]);assert.equal(r.round,1);
});
