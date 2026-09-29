'use strict';
(()=>{
const $=id=>document.getElementById(id),E=Tractor;
let identity;try{identity=JSON.parse(localStorage.getItem('tractor-online-user')||'null');}catch{}
let ws,room,selected=new Set(),forced=new Set(),replay=false,replayTimer,toastTimer,showBottom=false,offset=0,authenticated=false,stopped=false;
let hints={throw:true,void:true};try{hints={...hints,...JSON.parse(localStorage.getItem('tractor-online-hints')||'{}')};}catch{}
const pending=new Map();
// Keep auction controls alive across 100 ms deal snapshots, including pointerdown → click.
const bidButtons=[...E.SUITS,'SJ','BJ'].map(s=>{
  const button=document.createElement('button');button.type='button';button.dataset.suit=s;
  button.onclick=()=>{if(button.dataset.choice)command('bid',{choice:button.dataset.choice});};
  $('bids').append(button);return button;
});
const passBid=document.createElement('button');passBid.id='passBid';passBid.textContent='不叫';passBid.onclick=()=>command('pass');$('bids').append(passBid);
function toast(message){$('toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',4000);}
function command(type,data={}){if(!authenticated)return toast('连接恢复后再试');const id=crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');const m={type,id,revision:room?.revision,...data};pending.set(m.id,m);ws.send(JSON.stringify(m));}
function connect(){
  if(!identity)return;$('login').hidden=true;$('connection').textContent='正在连接…';
  ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/ws`);
  ws.onopen=()=>ws.send(JSON.stringify({type:'auth',token:identity.token}));
  ws.onmessage=event=>{const m=JSON.parse(event.data);
    if(m.type==='authenticated'){authenticated=true;$('connection').textContent='已连接 · '+m.user.name;$('roomActions').hidden=false;for(const action of pending.values())ws.send(JSON.stringify(action));const params=new URLSearchParams(location.search);if(!m.roomCode&&params.has('action')){const action=params.get('action');history.replaceState(null,'',location.pathname);if(action==='create')command('create',{settings:{startLevel:Number(params.get('level')||2),turnSeconds:Number(params.get('seconds')||30),maxRounds:Number(params.get('rounds')||0)}});else if(action==='join')command('join',{code:params.get('code')});}}
    if(m.type==='ack')pending.delete(m.id);
    if(m.type==='error'){pending.delete(m.id);toast(m.message);if(!authenticated&&m.message.includes('身份')){stopped=true;identity=null;localStorage.removeItem('tractor-online-user');$('login').hidden=false;ws.close();}}
    if(m.type==='left'){room=null;render();}
    if(m.type==='snapshot'){
      const old=room?.game,next=m.room.game;offset=m.serverTime-Date.now();
      if(old&&next&&m.room.revision>room.revision){
        if(next.currentBid&&JSON.stringify(next.currentBid)!==JSON.stringify(old.currentBid))GameAudio?.bid(next.currentBid,old.currentBid);
        if(next.plays.length>old.plays.length){const p=next.plays.at(-1);GameAudio?.play(p.cards,next.plays.slice(0,-1),next,p.player);}
        for(const n of [80,120,180])if(old.score<n&&next.score>=n){GameAudio?.say(`抓分达到${n}分`);if(n===80){$('summary').classList.add('score-celebrate');setTimeout(()=>$('summary').classList.remove('score-celebrate'),2200);}}
      }
      if(!room||room.round!==m.room.round||old?.phase==='over'&&next?.phase==='dealing'){selected.clear();replay=false;showBottom=false;}
      room=m.room;render();
    }
  };
  ws.onclose=e=>{authenticated=false;$('connection').textContent='连接中断 · 正在重连';if(e.code===4001){stopped=true;toast('此身份已在另一个页面连接');$('connection').textContent='已在其他页面登录';}if(!stopped)setTimeout(connect,1500);};
}
$('login').onsubmit=async event=>{event.preventDefault();try{const r=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('nickname').value})});const body=await r.json();if(!r.ok)throw Error(body.error);identity=body;localStorage.setItem('tractor-online-user',JSON.stringify(body));connect();}catch(e){toast(e.message);}};
$('create').onclick=()=>location.href='friends.html';$('join').onsubmit=e=>{e.preventDefault();command('join',{code:$('roomCode').value});};
$('leave').onclick=()=>command('leave');$('ready').onclick=()=>command('ready');
$('play').onclick=()=>command(room.game.phase==='bury'?'bury':'play',{cards:[...selected]});
$('hint').onclick=()=>{const g=room.game;selected=new Set(E.suggestions(g.hand,lead(),g)[0]?.map(c=>c.id)||[]);render();};
$('previous').onclick=()=>{clearTimeout(replayTimer);replay=!replay;if(replay)replayTimer=setTimeout(()=>{replay=false;render();},2000);render();};
$('bottom').onclick=()=>{showBottom=!showBottom;render();};
$('settingsBtn').onclick=()=>$('settings').showModal();$('closeSettings').onclick=()=>$('settings').close();
for(const kind of ['throw','void']){const button=$(kind+'HintToggle');const update=()=>button.textContent=(kind==='throw'?'甩牌提示':'缺门提示')+(hints[kind]?' ✓':' 关');button.onclick=()=>{hints[kind]=!hints[kind];localStorage.setItem('tractor-online-hints',JSON.stringify(hints));update();render();};update();}
const lead=()=>room?.game?.phase==='playing'&&!room.game.plays.some(p=>p.player===room.seat)?room.game.plays[0]?.cards:null;
function card(c,g){const node=document.createElement('div');node.className='card'+(['H','D'].includes(c.s)||c.r===16?' red':'');node.setAttribute('aria-label',E.symbol[c.s]+E.label(c.r));CardArt.apply(node,c);const stars=document.createElement('span');stars.className='stars';stars.textContent='★'.repeat(E.stars(c,g));node.append(stars);return node;}
function render(){
  $('lobby').hidden=!!room;$('table').hidden=!room;document.body.classList.toggle('in-room',!!room);if(!room){$('onlineApp').removeAttribute('style');return;}
  const g=room.game,seat=room.seat,rel=p=>(p-seat+4)%4;
  $('table').dataset.phase=g?.phase||'waiting';
  $('leave').hidden=!!g&&g.phase!=='over';$('players').replaceChildren();
  room.members.forEach((m,p)=>{const node=document.createElement('div');node.className=`seat seat-${rel(p)}`+(g?.phase==='playing'&&g.turn===p?' active':'');
    const avatar=document.createElement('span');avatar.className=`avatar avatar-${m.avatar||0}`;const name=document.createElement('b');name.textContent=m.name+(p===seat?'（你）':p%2===seat%2?' · 队友':'')+(g?.dealer===p?' 庄':'');const status=document.createElement('small');status.textContent=(m.online?'在线':'离线 · 超时托管')+' · '+(g?g.counts[p]+' 张':m.ready?'已准备':'待准备');node.append(avatar,name,status);
    if(g&&hints.void&&p!==seat){const missing=document.createElement('div');missing.className='void';missing.textContent=g.voids[p].map(s=>s==='T'?'主':E.symbol[s]).join(' ');node.append(missing);}
    if(g?.currentBid?.player===p&&!['dealing','bidding'].includes(g.phase)){const bid=document.createElement('span');bid.className='mini-bid';bid.textContent=g.currentBid.cards.map(c=>E.label(c.r)+E.symbol[c.s]).join(' ');node.append(bid);}
    $('players').append(node);
  });
  $('roomLabel').textContent=`好友房 ${room.code} · ${room.members.length}/4 人 · ${room.settings?.turnSeconds||30}秒 · ${room.settings?.maxRounds?room.settings.maxRounds+'局':'打到A'}`;
  $('ourLevel').textContent=E.label(room.levels[seat%2]);$('theirLevel').textContent=E.label(room.levels[1-seat%2]);
  const dealerKnown=g&&!['dealing','bidding'].includes(g.phase);
  $('ourRole').textContent=dealerKnown?(g.dealer%2===seat%2?'庄家':'抓分'):'';
  $('theirRole').textContent=dealerKnown?(g.dealer%2!==seat%2?'庄家':'抓分'):'';
  $('attackLabel').textContent=dealerKnown?(g.dealer%2===seat%2?'对方抓分':'我方抓分'):'闲家抓分';$('attackScore').textContent=g?.score||0;
  $('currentLevel').textContent=g?E.label(g.level):'—';$('currentTrump').textContent=g?.trump?(E.symbol[g.trump]||'无主'):'待定';
  $('roundNumber').textContent=g?`第 ${room.round} 局 · ${['dealing','bidding','bury'].includes(g.phase)?'未开打':'第 '+g.trick+' 轮'}`:'等待开局';
  $('tableScore').textContent=g?E.points((replay?g.lastTrick:g.plays).flatMap(p=>p.cards)):0;
  $('ready').hidden=!!g&&g.phase!=='over';$('ready').disabled=room.members[seat].ready;$('ready').textContent=room.members[seat].ready?'等待其他玩家准备':g?'准备下一局':'准备';
  const myTurn=g&&g.turn===seat&&!replay;
  $('play').hidden=!myTurn||!['bury','playing'].includes(g.phase);$('play').disabled=!authenticated;$('play').textContent=g?.phase==='bury'?'埋下 8 张':'出牌';$('hint').hidden=!myTurn||g.phase!=='playing';$('previous').disabled=!g?.lastTrick?.length;$('previous').textContent=replay?'返回':'上轮';$('bottom').disabled=!g?.bottom.length;
  $('message').textContent=replay?'上轮回看':!g?(room.members.length<4?'邀请好友入座':'请点击准备'):g.phase==='playing'?(g.turn===seat?'轮到你出牌':`等待 ${room.members[g.turn].name} 出牌`):g.phase==='bury'?(g.turn===seat?'请选择 8 张底牌':'等待庄家埋底'):g.phase==='dealing'?'发牌中 · 可抢主':g.phase==='bidding'?'可反主 / 自保':g.message;
  updateCountdown();
  $('bids').hidden=!g||!['dealing','bidding'].includes(g.phase);$('bidCards').hidden=$('bids').hidden;
  if(g&&['dealing','bidding'].includes(g.phase)){
    $('bidCards').textContent=g.currentBid?g.currentBid.cards.map(c=>E.label(c.r)+E.symbol[c.s]).join(' '):'等待亮主';
    const passed=!!g.passed?.[seat],options=passed?[]:E.bidOptions(g.hand,g.level,g.currentBid,seat);
    passBid.hidden=!!g.declared?.[seat]||g.currentBid?.player===seat;passBid.disabled=passed;passBid.textContent=passed?'已不叫':'不叫';
    for(const button of bidButtons){
      const s=button.dataset.suit,choice=options.find(o=>s.length===1?o.choice===s+'1':o.choice===s)||options.find(o=>o.choice===s+'2');
      button.textContent=(E.symbol[s]|| (s==='SJ'?'小王':'大王'))+' '+g.hand.filter(c=>s.length===1?c.s===s&&c.r!==g.level:c.s==='J'&&c.r===(s==='SJ'?15:16)).length;
      button.disabled=!choice;button.dataset.choice=choice?.choice||'';button.title=choice?(g.currentBid?.player===seat?'自保':g.currentBid?'反主':'亮主'):'尚无可亮的级牌，或不能超过当前亮主';
    }
  }
  $('plays').replaceChildren();if(g){const plays=replay?g.lastTrick:g.plays,winner=plays.length?E.winner(plays,g):null;for(const p of plays){const node=document.createElement('div');node.className='play-'+rel(p.player)+(p.player===winner?' winner':'');node.append(...p.cards.map(c=>card(c,g)));$('plays').append(node);}}
  $('hand').replaceChildren();$('selectionNotice').textContent='';if(g){
    const handIds=new Set(g.hand.map(c=>c.id));selected=new Set([...selected].filter(id=>handIds.has(id)));forced=new Set(E.forcedCards(g.hand,lead(),g).map(c=>c.id));for(const id of forced)selected.add(id);
    const safe=hints.throw?E.publicThrowIds(g.hand,g.publicCards,g):new Set(),tractors=E.tractorIds(g.hand,g),follow=lead(),cat=follow?E.category(follow[0],g):null,same=g.hand.filter(c=>E.category(c,g)===cat).length;
    g.hand.forEach(c=>{const node=card(c,g);node.dataset.id=c.id;node.classList.toggle('selected',selected.has(c.id));node.classList.toggle('dim',!!follow&&same>=follow.length&&E.category(c,g)!==cat);const mark=document.createElement('span');mark.className='mark';mark.textContent=forced.has(c.id)?'必':safe.has(c.id)?'甩':tractors.has(c.id)?'连对':'';node.append(mark);if(g.phase==='bury'&&g.bottom.some(b=>b.id===c.id)){const tag=document.createElement('span');tag.className='new';tag.textContent='底';node.append(tag);} $('hand').append(node);});
    const chosen=g.hand.filter(c=>selected.has(c.id));if(myTurn&&g.phase==='playing'&&g.plays.length&&chosen.length&&!E.legal(g.hand,chosen,follow,g)&&E.winner([...g.plays,{player:seat,cards:chosen}],g)===seat)$('selectionNotice').textContent='您选取的牌大于其他玩家';
  }
  $('bottomReveal').replaceChildren();if(g&&(g.phase==='over'||showBottom)&&g.bottom.length){const label=document.createElement('div');label.textContent='底牌 · '+E.points(g.bottom)+' 分';$('bottomReveal').append(label,...g.bottom.map(c=>card(c,g)));}
  layout();
}
function layout(){
  if(!room)return;
  TableLayout.fit($('onlineApp'));TableLayout.hand($('hand'));
  [...$('plays').children].forEach(TableLayout.plays);
}
let drag=null;
$('hand').onpointerdown=e=>{const node=e.target.closest('[data-id]');if(!node||!room.game)return;e.preventDefault();$('hand').setPointerCapture(e.pointerId);drag={start:room.game.hand.findIndex(c=>c.id===node.dataset.id),anchor:node.dataset.id,add:!selected.has(node.dataset.id),base:new Set(selected),shift:e.shiftKey};selectRange(drag.start);};
function selectRange(end){const g=room.game,lo=Math.min(drag.start,end),hi=Math.max(drag.start,end);selected=new Set(drag.base);let chosen=g.hand.slice(lo,hi+1);const n=lead()?.length,limit=n===1?1:n===2?2:Infinity;
  if(lo===hi&&limit!==1&&!drag.shift){const pair=g.hand.filter(c=>E.key(c)===E.key(chosen[0]));if(pair.length===2)chosen=pair;}
  if(drag.add&&selected.size+chosen.filter(c=>!selected.has(c.id)).length>limit)selected=new Set(forced);
  for(const c of chosen.slice(0,limit))if(drag.add)selected.add(c.id);else if(!forced.has(c.id))selected.delete(c.id);
  GameAudio?.select();render();
}
document.addEventListener('pointermove',e=>{if(!drag)return;drag.start=room.game.hand.findIndex(c=>c.id===drag.anchor);if(drag.start<0){drag=null;return;}const node=document.elementFromPoint(e.clientX,e.clientY)?.closest('#hand [data-id]');if(node)selectRange(room.game.hand.findIndex(c=>c.id===node.dataset.id));});document.addEventListener('pointerup',e=>{drag=null;if($('hand').hasPointerCapture(e.pointerId))$('hand').releasePointerCapture(e.pointerId);});document.addEventListener('pointercancel',()=>drag=null);
window.addEventListener('resize',layout);
window.visualViewport?.addEventListener('resize',layout);
function updateCountdown(){const g=room?.game,visible=g&&['bidding','bury','playing'].includes(g.phase);$('countdown').hidden=!visible;if(visible){const seconds=Math.max(0,Math.ceil((g.deadline-Date.now()-offset)/1000));$('countdown').textContent=seconds;$('countdown').classList.toggle('urgent',seconds<=5);}}
setInterval(updateCountdown,250);
connect();
})();
