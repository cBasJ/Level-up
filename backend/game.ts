import { createRequire } from 'node:module';
import { randomInt,randomUUID } from 'node:crypto';
import type { Room,Game,Card } from './types';
export const E=createRequire(import.meta.url)('../engine.js');
export const TURN_MS=30000;
function check(ok: unknown,message: string): asserts ok { if(!ok)throw Error(message); }
function remove(g:Game,p:number,cards:Card[]){const ids=new Set(cards.map(c=>c.id));g.hands[p]=g.hands[p].filter(c=>!ids.has(c.id));}
function deadline(g:Game,now:number){g.deadline=now+(g.hands[g.turn].length===1?650:(g.turnMs||TURN_MS));}
export function start(room:Room,now:number){
  if(room.game?.matchOver){room.levels=[room.settings?.startLevel||2,room.settings?.startLevel||2];room.dealer=0;room.round=1;}else if(room.game)room.round++;
  const deck=E.deck(()=>randomInt(0,0x100000000)/0x100000000);
  room.members.forEach(m=>m.ready=false);
  room.game={turnMs:(room.settings?.turnSeconds||30)*1000,id:randomUUID(),phase:'dealing',level:room.levels[room.dealer%2],trump:null,dealer:room.dealer,turn:room.dealer,hands:[[],[],[],[]],bottom:deck.slice(100),deck:deck.slice(0,100),dealIndex:0,plays:[],lastTrick:[],publicCards:[],voids:[[],[],[],[]],currentBid:null,score:0,trick:1,deadline:now+100,message:'发牌中，可以抢主'};
}
function finishBid(room:Room,now:number){const g=room.game!;g.trump=g.currentBid?.trump||'NT';if(room.round===1&&g.currentBid)g.dealer=g.currentBid.player;g.turn=g.dealer;g.hands[g.dealer].push(...g.bottom);g.phase='bury';g.deadline=now+(g.turnMs||TURN_MS);g.message='庄家选取 8 张底牌';}
function commit(g:Game,player:number,cards:Card[],now:number){
  const missing=E.revealedVoid(g.plays[0]?.cards,cards,g);if(missing&&!g.voids[player].includes(missing))g.voids[player].push(missing);
  remove(g,player,cards);g.publicCards.push(...cards);g.plays.push({player,cards});
  if(g.plays.length===4){const winner=E.winner(g.plays,g);if(winner%2!==g.dealer%2)g.score+=E.points(g.plays.flatMap(p=>p.cards));g.phase='review';g.deadline=now+1900;g.message='本轮结束';}
  else{g.turn=(player+3)%4;deadline(g,now);g.message='等待出牌';}
}
export function act(room:Room,player:number,type:string,data:any,now:number){
  if(type==='ready'){check(!room.game||room.game.phase==='over','牌局尚未结束');room.members[player].ready=true;if(room.members.length===4&&room.members.every(m=>m.ready))start(room,now);return;}
  const g=room.game;check(g,'请先准备');
  if(type==='pass'){
    check(g.phase==='dealing'||g.phase==='bidding','已经结束定主');
    (g.passed||=[false,false,false,false])[player]=true;return;
  }
  if(type==='bid'){
    check(g.phase==='dealing'||g.phase==='bidding','已经结束定主');check(typeof data.choice==='string','亮主格式错误');
    check(!g.passed?.[player],'本局已选择不叫，不能再抢主、反主或自保');
    const error=E.bidError(g.hands[player],data.choice,g.level,g.currentBid,player);check(!error,error);
    (g.declared||=[false,false,false,false])[player]=true;
    g.currentBid={...E.declaration(g.hands[player],data.choice,g.level),player};g.trump=g.currentBid!.trump;
    if(g.phase==='bidding'){g.deadline=now+8000;if(g.currentBid!.strength===4)finishBid(room,now);}return;
  }
  check((type==='bury'&&g.phase==='bury')||(type==='play'&&g.phase==='playing'),'当前阶段不能执行此操作');check(g.turn===player,'尚未轮到你');
  check(Array.isArray(data.cards)&&data.cards.length>0&&data.cards.length<=33&&data.cards.every((x:unknown)=>typeof x==='string'),'选牌格式错误');
  const ids=new Set(data.cards);check(ids.size===data.cards.length,'不能重复选择同一张牌');
  const cards=E.sort(g.hands[player],g).filter((c:Card)=>ids.has(c.id));check(cards.length===ids.size,'不能使用不在手中的牌');
  if(type==='bury'){check(cards.length===8,'必须埋 8 张底牌');g.bottom=cards;remove(g,player,cards);g.phase='playing';deadline(g,now);g.message='庄家领出';return;}
  const error=E.legal(g.hands[player],cards,g.plays[0]?.cards,g);check(!error,error);
  if(!g.plays.length&&E.shape(cards,g)?.type==='throw'){
    const attempt=E.checkThrow(cards,g.hands,player,g);
    if(!attempt.ok){g.phase='throwing';g.plays=[{player,cards}];remove(g,player,cards);g.pending={player,cards:attempt.cards};g.deadline=now+1200;g.message='甩牌核验中';return;}
  }
  commit(g,player,cards,now);
}
export function tick(room:Room,now:number):boolean {
  const g=room.game;if(!g||g.phase==='over'||now<g.deadline)return false;
  if(g.phase==='dealing'){
    const p=(g.dealer+3*g.dealIndex)%4;g.hands[p].push(g.deck[g.dealIndex++]);g.deadline=now+100;
    if(g.dealIndex===100){g.deck=[];g.phase='bidding';g.deadline=now+8000;if(g.currentBid?.strength===4)finishBid(room,now);}return true;
  }
  if(g.phase==='bidding'){finishBid(room,now);return true;}
  if(g.phase==='bury'){const cards=[...g.hands[g.dealer]].sort((a,b)=>E.points([a])-E.points([b])||E.rank(a,g)-E.rank(b,g)).slice(0,8);act(room,g.dealer,'bury',{cards:cards.map(c=>c.id)},now);return true;}
  if(g.phase==='throwing'){const pending=g.pending!;g.hands[pending.player].push(...g.plays[0].cards);g.plays=[];g.phase='playing';delete g.pending;commit(g,pending.player,pending.cards,now);g.message='甩牌失败，多余手牌已退回';return true;}
  if(g.phase==='playing'){const cards=E.choose(g.hands[g.turn],g.plays,g,g.turn);act(room,g.turn,'play',{cards:cards.map((c:Card)=>c.id)},now);return true;}
  const winner=E.winner(g.plays,g);g.lastTrick=structuredClone(g.plays);
  if(g.hands.every(h=>h.length===0)){
    if(winner%2!==g.dealer%2)g.score+=E.points(g.bottom)*E.bottomMultiplier(g.plays[0].cards,g);
    const result=E.settle(g.score),team=result.defend?g.dealer%2:1-g.dealer%2;
    room.levels[team]=Math.min(14,room.levels[team]+result.steps);room.dealer=(g.dealer+(result.defend?2:3))%4;
    g.matchOver=g.level===14||!!(room.settings?.maxRounds&&room.round>=room.settings.maxRounds);g.phase='over';g.message=g.matchOver?`整场结束，准备后双方从 ${E.label(room.settings?.startLevel||2)} 开始`:`本局结束，获胜方升 ${result.steps} 级`;return true;
  }
  g.trick++;g.turn=winner;g.plays=[];g.phase='playing';deadline(g,now);return true;
}
// Explicit allowlist: never spread the authoritative state into a network response.
export function view(room:Room,user:string,connected:Set<string>){
  const seat=room.members.findIndex(m=>m.id===user);check(seat>=0,'你不在此房间');const g=room.game;
  return {settings:room.settings||{startLevel:2,turnSeconds:30,maxRounds:0},code:room.code,revision:room.revision,seat,levels:room.levels,round:room.round,members:room.members.map(m=>({name:m.name,avatar:m.avatar||0,ready:m.ready,online:connected.has(m.id)})),game:g?{
    phase:g.phase,level:g.level,trump:g.trump,dealer:g.dealer,turn:g.turn,hand:E.sort(g.hands[seat],g),counts:g.hands.map(h=>h.length),
    bottom:g.phase==='over'||g.dealer===seat?g.phase==='dealing'||g.phase==='bidding'?[]:g.bottom:[],
    declared:g.declared||[false,false,false,false],passed:g.passed||[false,false,false,false],plays:g.plays,lastTrick:g.lastTrick,publicCards:g.publicCards,voids:g.voids,currentBid:g.currentBid,score:g.score,trick:g.trick,deadline:g.deadline,message:g.message,matchOver:g.matchOver
  }:null};
}
