'use strict';
const E=Tractor,$=id=>document.getElementById(id),names=['你','西山','北风','东篱'];
const BID_WINDOW=8,DEAL_DELAY=100,BOT_BID_DELAY=1800;
let TEST_DEAL=new URLSearchParams(location.search).get('normal')!=='1';
try{if(!new URLSearchParams(location.search).has('normal'))TEST_DEAL=localStorage.getItem('tractor-test-deal')!=='false';}catch{}
let forcedSelection=new Set();
function followLead(){return state.phase==='playing'&&!state.plays.some(p=>p.player===0)?state.plays[0]?.cards:null;}
function changeSelection(id,add,single){
  const ids=selectionIds(id,single),lead=followLead(),type=lead?E.pattern(lead,state)?.type:null;
  if(add){
    const limit=type==='single'?1:type==='pair'?2:Infinity;
    if(ids.length>=limit||new Set([...selected,...ids]).size>limit)selected=new Set(forcedSelection);
    for(const value of ids)selected.add(value);
  }else for(const value of ids)if(!forcedSelection.has(value))selected.delete(value);
}
function enforceForcedSelection(){
  const lead=followLead();if(!lead)return;
  const extras=[...selected].filter(id=>!forcedSelection.has(id));
  if(forcedSelection.size)selected=new Set([...forcedSelection,...extras.slice(0,Math.max(0,lead.length-forcedSelection.size))]);
}
let showThrowHints=true,showVoidHints=true;
try{const prefs=JSON.parse(localStorage.getItem('tractor-hints')||'{}');showThrowHints=prefs.throw!==false;showVoidHints=prefs.void!==false;}catch{}
function togglePublicHint(kind){
  if(kind==='throw')showThrowHints=!showThrowHints;else showVoidHints=!showVoidHints;
  try{localStorage.setItem('tractor-hints',JSON.stringify({throw:showThrowHints,void:showVoidHints}));}catch{}
  render();
}
let scoreAudio,scoreEffectTimer;
function unlockScoreAudio(){
  try{scoreAudio ||= new (window.AudioContext||window.webkitAudioContext)();if(scoreAudio.state==='suspended')scoreAudio.resume().catch(()=>{});}catch{}
}
document.addEventListener('pointerdown',unlockScoreAudio);
document.addEventListener('keydown',unlockScoreAudio);
function scoreChime(threshold,delay=0){
  if(!scoreAudio||scoreAudio.state!=='running')return;
  const notes=threshold===80?[523,659,784,1047]:threshold===120?[659,831,988]:[784,988,1175,1568];
  notes.forEach((frequency,i)=>{
    const oscillator=scoreAudio.createOscillator(),gain=scoreAudio.createGain(),at=scoreAudio.currentTime+delay+i*.16;
    oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.15,at+.025);gain.gain.exponentialRampToValueAtTime(.001,at+.4);
    oscillator.connect(gain);gain.connect(scoreAudio.destination);oscillator.start(at);oscillator.stop(at+.42);
  });
}
function addScore(points){
  const before=state.score;state.score+=points;
  const crossed=[80,120,180].filter(n=>before<n&&state.score>=n);
  crossed.forEach((threshold,i)=>{scoreChime(threshold,i*.9);log('抓分达到 '+threshold+' 分！');});
  if(crossed.includes(80)){
    const effect=$('scoreCelebration');effect.textContent='抓分突破 80 分！';effect.classList.remove('show');void effect.offsetWidth;effect.classList.add('show');
    clearTimeout(scoreEffectTimer);scoreEffectTimer=setTimeout(()=>effect.classList.remove('show'),2400);
  }
}
function prepareTestDeal(cards,start,level){
  const ranks=Array.from({length:13},(_,i)=>i+2).filter(r=>r!==level),suit=E.SUITS[Math.floor(Math.random()*4)];
  const first=Math.floor(Math.random()*(ranks.length-1));
  const wanted=[...cards.filter(c=>c.s===suit&&[ranks[first],ranks[first+1]].includes(c.r)),cards.find(c=>c.s==='J'&&c.r===16)];
  const slots=Array.from({length:100},(_,i)=>i).filter(i=>(start+i)%4===0);
  wanted.forEach((card,i)=>{const from=cards.findIndex(c=>c.id===card.id),to=slots[i];[cards[from],cards[to]]=[cards[to],cards[from]];});
  return cards;
}
let levels=[2,2],dealer=0,round=1,state,selected=new Set();
let timer,dealTimer,botBidTimer,auctionTimer;
let selectionGesture=null,pairSelection=true,replaySnapshot=null,replayTimer;
const auctionOpen=()=>['dealing','bidding'].includes(state.phase);
const modalOpen=()=>!!document.querySelector('dialog[open]');
const trumpName=trump=>trump==='NT'?'无主':trump?E.symbol[trump]+' 主':'待定';
function startMatch(ourLevel=2){levels=[ourLevel,2];dealer=0;round=1;newGame();}
function clearTimers(){for(const t of [timer,dealTimer,botBidTimer,auctionTimer,replayTimer])clearTimeout(t);replaySnapshot=null;}
function log(text){
  state.logs.unshift(text);state.logs=state.logs.slice(0,60);
  $('log').replaceChildren(...state.logs.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
}
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function cardHTML(c){
  const score=E.points([c]),stars=E.stars(c,state);
  return '<span class="rank">'+(c.s==='J'?(c.r===16?'大<br>王':'小<br>王'):E.label(c.r))+'</span><span class="suit">'+E.symbol[c.s]+'</span><span class="big-suit">'+E.symbol[c.s]+'<small>'+(c.s==='J'?'':E.label(c.r))+'</small></span>'+(stars?'<span class="trump-mark '+(stars===2?'double-stars':'')+'" title="'+(stars===2?'正主级牌或大小王 · 两星':'主牌 · 一星')+'">'+'★'.repeat(stars)+'</span>':'')+(score?'<span class="point-mark">'+score+'分</span>':'');
}
function cardElement(c,interactive=false){
  const el=document.createElement(interactive?'button':'div');
  el.className='card '+(c.s==='H'||c.s==='D'||c.r===16?'red ':'')+(c.s==='J'?'joker ':'')+(interactive&&state.lastDealt===c.id?'fresh':'');
  el.innerHTML=cardHTML(c);
  el.setAttribute('aria-label',E.symbol[c.s]+E.label(c.r)+(E.category(c,state)==='T'?' 主牌':'')+(E.points([c])?' '+E.points([c])+'分':''));
  if(interactive){
    el.dataset.id=c.id;el.classList.toggle('selected',selected.has(c.id));el.setAttribute('aria-pressed',selected.has(c.id));
    el.onclick=event=>{
      if(event.detail!==0)return; // Pointer gestures are handled on the stable hand container.
      if(!state.hands[0].length)return;
      changeSelection(c.id,!selected.has(c.id),event.shiftKey);syncHandSelection();selectionNotice();
    };
  }
  return el;
}
function renderHand(){
  endSelectionGesture();
  forcedSelection=new Set(E.forcedCards(state.hands[0],followLead(),state).map(c=>c.id));
  selected=new Set([...selected].filter(id=>state.hands[0].some(c=>c.id===id)));
  for(const id of forcedSelection)selected.add(id);
  enforceForcedSelection();
  const hand=$('hand');hand.style.setProperty('--step',Math.min(51,1232/Math.max(1,state.hands[0].length-1))+'px');
  const tractorCards=E.tractorIds(state.hands[0],state);
  const throwCards=showThrowHints&&['playing','review','throwing'].includes(state.phase)?E.publicThrowIds(state.hands[0],state.publicCards||[],state):new Set();
  const lead=state.phase==='playing'&&!replaySnapshot?state.plays[0]:null;
  const followCategory=lead?E.category(lead.cards[0],state):null;
  const mustFollow=lead&&lead.player!==0&&state.hands[0].filter(c=>E.category(c,state)===followCategory).length>=lead.cards.length;
  hand.replaceChildren(...E.sort(state.hands[0],state).map((c,index)=>{const el=cardElement(c,true);el.style.zIndex=String(index+1);if(tractorCards.has(c.id)){el.classList.add('tractor-member');const tag=document.createElement('span');tag.className='tractor-mark';tag.textContent='连对';tag.title='这张牌可与相邻对子组成拖拉机';el.append(tag);}return el;}));
  $('handCount').textContent=state.hands[0].length+' 张';syncHandSelection();
  for(const el of hand.children){
    const card=state.hands[0].find(c=>c.id===el.dataset.id);
    if(throwCards.has(card.id)){const tag=document.createElement('span');tag.className='throw-mark';tag.textContent='甩';tag.title='根据公开出牌推算，可与同门其他蓝色标记牌一起甩出';el.append(tag);}
    if(mustFollow&&E.category(card,state)!==followCategory){el.classList.add('off-suit');el.title='本轮须跟首出花色';}
    if(state.phase==='bury'&&state.dealer===0&&state.pickedBottomIds?.includes(card.id)){
      el.classList.add('picked-bottom');const tag=document.createElement('span');tag.className='bottom-pick-mark';tag.textContent='底';el.append(tag);el.setAttribute('aria-label',el.getAttribute('aria-label')+' 新获得的底牌');
    }
  }
}
function syncHandSelection(){
  for(const id of forcedSelection)selected.add(id);
  enforceForcedSelection();
  for(const el of $('hand').children){el.classList.toggle('selected',selected.has(el.dataset.id));el.classList.toggle('forced-card',forcedSelection.has(el.dataset.id));el.setAttribute('aria-pressed',String(selected.has(el.dataset.id)));if(forcedSelection.has(el.dataset.id))el.title='本轮必出，已自动选中';}
  $('selectedCount').textContent='已选 '+selected.size+' 张';
  const canAct=!replaySnapshot&&state.turn===0&&['bury','playing'].includes(state.phase);
  $('play').disabled=!canAct||selected.size===0;$('hint').disabled=!canAct;
  $('play').textContent=state.phase==='bury'?'确认埋底':'出 牌';
  const cards=state.hands[0].filter(c=>selected.has(c.id));
  $('pairToggle').textContent=pairSelection?'对子连选 ✓':'单张选择';$('pairToggle').setAttribute('aria-pressed',String(pairSelection));
  const bigger=!replaySnapshot&&state.phase==='playing'&&state.turn===0&&state.plays.length>0&&cards.length>0&&!E.legal(state.hands[0],cards,state.plays[0].cards,state)&&E.winner([...state.plays,{player:0,cards}],state)===0;
  $('selectionNotice').textContent=bigger?'您选取的牌大于其他玩家':'';
}
function selectionNotice(){notice(state.phase==='bury'?'请选择 8 张底牌，当前已选 '+selected.size+' 张。':'已选择 '+selected.size+' 张牌。');}
function selectionIds(id,single=false){
  const card=state.hands[0].find(c=>c.id===id);
  if(!card||single||!pairSelection||(state.phase==='playing'&&state.plays[0]?.cards.length===1))return [id];
  return state.hands[0].filter(c=>E.key(c)===E.key(card)).map(c=>c.id);
}
function endSelectionGesture(restore=false){
  if(!selectionGesture)return;
  const gesture=selectionGesture;selectionGesture=null;
  if($('hand').hasPointerCapture(gesture.pointerId))$('hand').releasePointerCapture(gesture.pointerId);
  if(restore){selected=gesture.original;syncHandSelection();selectionNotice();}
}
function setupHandSelection(){
  const hand=$('hand');
  function updateRange(index){
    const gesture=selectionGesture;if(!gesture)return;
    selected=new Set(gesture.original);
    for(let i=Math.min(index,gesture.start);i<=Math.max(index,gesture.start);i++){
      changeSelection(gesture.ids[i],gesture.add,gesture.single);
    }
    syncHandSelection();selectionNotice();
  }
  function move(event){
    const gesture=selectionGesture;if(!gesture||event.pointerId!==gesture.pointerId)return;
    const position=gesture.portrait?event.clientY:event.clientX;
    if(!gesture.moved&&Math.abs(position-gesture.origin)<5)return;
    gesture.moved=true;
    let index=0;for(let i=1;i<gesture.edges.length;i++)if(position>=gesture.edges[i])index=i;
    updateRange(index);
  }
  hand.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary||selectionGesture||modalOpen()||!state.hands[0].length)return;
    const card=event.target.closest('[data-id]');if(!card||!hand.contains(card))return;
    event.preventDefault();
    const nodes=[...hand.children],portrait=innerHeight>innerWidth;
    selectionGesture={pointerId:event.pointerId,ids:nodes.map(el=>el.dataset.id),edges:nodes.map(el=>{const rect=el.getBoundingClientRect();return portrait?rect.top:rect.left;}),start:nodes.indexOf(card),original:new Set(selected),add:!selected.has(card.dataset.id),single:event.shiftKey,portrait,origin:portrait?event.clientY:event.clientX,moved:false};
    hand.setPointerCapture(event.pointerId);updateRange(selectionGesture.start);
  });
  hand.addEventListener('pointermove',move);
  hand.addEventListener('pointerup',event=>{if(selectionGesture?.pointerId!==event.pointerId)return;move(event);endSelectionGesture();});
  hand.addEventListener('pointercancel',event=>{if(selectionGesture?.pointerId===event.pointerId)endSelectionGesture(true);});
  hand.addEventListener('lostpointercapture',event=>{if(selectionGesture?.pointerId===event.pointerId)endSelectionGesture(true);});
  window.addEventListener('blur',()=>endSelectionGesture(true));
}
function render(){
  $('testDealToggle').textContent='测试发牌 '+(TEST_DEAL?'✓':'关');$('testDealToggle').setAttribute('aria-pressed',String(TEST_DEAL));
  $('throwHintToggle').textContent='甩牌提示 '+(showThrowHints?'✓':'关');$('throwHintToggle').setAttribute('aria-pressed',String(showThrowHints));
  $('voidHintToggle').textContent='缺门提示 '+(showVoidHints?'✓':'关');$('voidHintToggle').setAttribute('aria-pressed',String(showVoidHints));
  $('game').classList.toggle('is-replaying',!!replaySnapshot);
  $('game').dataset.phase=state.phase;$('game').dataset.turn=String(state.turn);
  $('turnIcon').textContent=state.phase==='bury'?'底':state.phase==='review'?'胜':names[state.turn]?.slice(0,1)||'你';
  $('roundTitle').textContent='第 '+round+' 局';
  $('phaseTitle').textContent=replaySnapshot?'回看上轮':({dealing:'发牌 · 抢主',bidding:'反主倒计时',bury:'庄家埋底',playing:'正在出牌',throwing:'甩牌核验',review:'本轮结算',over:'本局结束'})[state.phase];
  $('level').textContent=E.label(state.level);$('trump').textContent=trumpName(state.trump);
  $('ourLevel').textContent=E.label(levels[0]);$('theirLevel').textContent=E.label(levels[1]);$('score').textContent=state.score;
  $('scoreBar').style.width=Math.min(100,state.score/80*100)+'%';$('attackTeam').textContent=state.dealer%2===0?'对方累计抓分':'我方累计抓分';
  $('bottomState').textContent=auctionOpen()?'底牌未领取':state.phase==='bury'?'庄家埋底中':state.phase==='over'?'底分 '+E.points(state.bottom):'已埋底 · 待揭晓';
  const view=replaySnapshot||state;
  const inTrick=['playing','throwing','review','over'].includes(state.phase);
  $('trickCount').textContent=inTrick?(replaySnapshot?'回看 ':'')+'第 '+(view.trick+1)+' 轮':state.phase==='bury'?'准备出牌':'发牌阶段';
  const tablePoints=E.points(view.plays.flatMap(p=>p.cards));
  $('tablePoints').textContent=String(tablePoints);
  const bestPlayer=view.plays.length?E.winner(view.plays,state):null;
  $('trickLeader').textContent=bestPlayer===null?'等待出牌':names[bestPlayer]+(replaySnapshot||state.phase==='review'||state.phase==='over'?' · 赢得本轮':' · 当前最大');
  $('trickStatus').textContent=replaySnapshot?'上轮回放 · 2 秒':state.phase==='review'||state.phase==='over'?'本轮已结算':inTrick?'已出 '+state.plays.length+' / 4 家':'尚未开打';
  for(let i=0;i<4;i++){
    const player=$('player'+i);
    player.classList.toggle('active',!replaySnapshot&&state.turn===i&&['playing','bury'].includes(state.phase));
    const showDealer=round!==1||!auctionOpen()||!!state.currentBid;
    const revealed=state.declarations[i];
    player.innerHTML='<span class="avatar avatar-'+i+'" aria-hidden="true"></span><div><div class="player-name">'+names[i]+(showDealer&&i===state.dealer?'<span class="badge dealer-badge">庄</span>':i===2?'<span class="badge">队友</span>':'')+'</div><div class="meta"><span class="remaining">▣ '+state.hands[i].length+'</span>'+(i===0?' · 休闲玩家':i===2?' · 你的队友':' · 电脑玩家')+'</div></div>'+(auctionOpen()&&revealed?'<span class="declaration-tag '+(state.currentBid?.player===i?'effective':'')+'">'+(revealed.trump==='NT'?(revealed.strength===4?'双大王':'双小王'):E.symbol[revealed.trump]+E.label(state.level)+(revealed.strength===2?' ×2':''))+'</span>':'');
    if(!auctionOpen()&&state.currentBid?.player===i){const badge=document.createElement('div');badge.className='final-bid';badge.title='最终定主：'+trumpName(state.currentBid.trump);badge.replaceChildren(...state.currentBid.cards.map(c=>cardElement(c)));player.append(badge);}
    const voids=showVoidHints?(state.voids?.[i]||[]):[];
    if(voids.length){const badge=document.createElement('span');badge.className='void-suits';badge.setAttribute('aria-label','已确认缺门');for(const cat of voids){const mark=document.createElement('span');mark.textContent=cat==='T'?'主':E.symbol[cat];mark.className=cat==='T'||cat==='H'||cat==='D'?'void-red':'';mark.title='已确认缺'+(cat==='T'?'主牌':E.symbol[cat]+'副牌');badge.append(mark);}player.append(badge);}
    const container=$('play'+i),play=view.plays.find(p=>p.player===i);
    const cards=(play?.cards||[]).map((c,index)=>{const el=cardElement(c);el.style.zIndex=String(index+1);return el;});
    container.replaceChildren(...cards);
    container.classList.toggle('is-winning',!!play&&bestPlayer===i);
    if(play){
      container.setAttribute('aria-label',names[i]+'出牌'+(bestPlayer===i?'，当前最大':'')+'，'+E.points(play.cards)+'分');
      if(bestPlayer===i){
        const badge=document.createElement('span');badge.className='winner-badge';
        badge.textContent=replaySnapshot?'★ 上轮最大':state.phase==='review'||state.phase==='over'?'★ 本轮最大 · 胜':'★ 当前最大';container.append(badge);
      }
    }else container.removeAttribute('aria-label');
  }
  $('previousBtn').disabled=!state.lastTrick||state.phase==='throwing';$('previousBtn').innerHTML=replaySnapshot?'<span>↩</span>返回':'<span>↶</span>上轮';$('previousBtn').classList.toggle('replaying',!!replaySnapshot);
  renderHand();
  if(auctionOpen())renderAuction();
}
function newGame(){
  clearTimers();selected.clear();const cards=E.deck();
  clearTimeout(scoreEffectTimer);$('scoreCelebration').classList.remove('show');
  if(TEST_DEAL)prepareTestDeal(cards,dealer,levels[dealer%2]);
  document.querySelector('.local-label').textContent=TEST_DEAL?'● 测试发牌':'● 本地牌局';
  state={level:levels[dealer%2],trump:null,dealer,dealStart:dealer,turn:dealer,phase:'dealing',hands:[[],[],[],[]],bottom:cards.slice(100),dealCards:cards.slice(0,100),dealIndex:0,fastDeal:false,lastDealt:null,plays:[],score:0,trick:0,logs:[],lastTrick:null,currentBid:null,firstBid:null,declarations:[null,null,null,null],bidSeconds:BID_WINDOW};
  state.publicCards=[];state.voids=[[],[],[],[]];
  log('开始逐张发牌，可随时用已到手的级牌抢主。');
  showBid();render();notice('发牌中：级牌到手即可抢主，拿到对子可反主或自保。');
  dealTimer=setTimeout(dealNext,DEAL_DELAY);scheduleBotBid();
}
function showBid(){
  $('center').className='center-panel auction-panel';
  $('center').innerHTML='<div class="auction-top"><div class="auction-feature"><div id="bidCards" class="bid-cards"></div><strong id="auctionLeader">等待抢主</strong><small id="auctionStrength">有级牌即可抢主</small></div><div class="deal-display"><div class="deck-stack" aria-hidden="true"><i></i><i></i><i>♠</i></div><strong id="dealStatus">正在发牌</strong><div class="deal-progress"><span id="dealProgress"></span></div><small id="dealCount">0 / 100 张</small></div></div><h2 id="bidHeading">选择要亮出的牌</h2><div class="suit-options">'+[...E.SUITS,'SJ','BJ'].map(s=>'<button class="'+(s==='H'||s==='D'||s==='BJ'?'red ':'')+(s.length===2?'joker-bid':'')+'" data-bidgroup="'+s+'" disabled><span>'+(s==='SJ'?'小王':s==='BJ'?'大王':E.symbol[s])+'</span><small class="bid-count">0</small><em class="bid-action">未到手</em></button>').join('')+'</div><div class="auction-footer"><span id="bidCountdown">边发边抢</span><button class="pass" id="passBid">加速发牌 →</button></div><p class="bid-rule">花色数字不计级牌，普通主牌计入 · 单张级牌 ＜ 级牌对子 ＜ 双小王 ＜ 双大王</p>';
  $('center').querySelectorAll('[data-bidgroup]').forEach(button=>button.onclick=()=>{
    const options=E.bidOptions(state.hands[0],state.level,state.currentBid,0);
    const choice=options.filter(b=>button.dataset.bidgroup.length===1?b.trump===button.dataset.bidgroup:b.choice===button.dataset.bidgroup).at(-1);
    if(choice)makeBid(choice.choice,0);
  });
  $('passBid').onclick=()=>{
    if(state.phase==='dealing'){
      state.fastDeal=true;$('passBid').disabled=true;notice('已加速发牌，发完后仍有 8 秒可以反主。');
    }else if(state.phase==='bidding'){
      state.bidSeconds=Math.min(state.bidSeconds,3);
      notice('你暂不反主，等待其他玩家最后确认。');
      clearTimeout(botBidTimer);botBidTimer=setTimeout(botBidTick,500);renderAuction();
    }
  };
}
function renderAuction(){
  const dealing=state.phase==='dealing',current=state.currentBid;
  $('dealStatus').textContent=dealing?'正在发牌':'发牌完成';
  $('dealCount').textContent=state.dealIndex+' / 100 张 · 另留 8 张底牌';
  $('dealProgress').style.width=state.dealIndex+'%';
  $('bidHeading').textContent=current?(current.strength===4?'双大王无主 · 已是最高档位':current.player===0?(current.strength===1?'你已亮主，可补对子自保':'你已亮主，等待其他玩家'):'可用更高档位反主'):'级牌到手，立即抢主';
  $('auctionLeader').textContent=current?names[current.player]+' · '+trumpName(current.trump):'尚未有人亮主';
  $('auctionStrength').textContent=current?['','单张级牌','级牌对子','双小王 · 无主','双大王 · 无主'][current.strength]:'先亮先得，同档不可反';
  $('bidCards').replaceChildren(...(current?.cards||[]).map(c=>cardElement(c)));
  $('bidCountdown').textContent=dealing?(current?.strength===4?'双大王无主 · 发完直接定主':'边发边抢 · 已获 '+state.hands[0].length+' 张'):'最后反主时间 '+state.bidSeconds+' 秒';
  $('passBid').textContent=dealing?(state.fastDeal?'正在加速…':'加速发牌 →'):'不反主，继续 →';
  $('passBid').disabled=dealing&&state.fastDeal;
  const options=E.bidOptions(state.hands[0],state.level,current,0);
  $('center').querySelectorAll('[data-bidgroup]').forEach(button=>{
    const group=button.dataset.bidgroup;
    const count=state.hands[0].filter(c=>group.length===1?c.s===group&&c.r!==state.level:c.s==='J'&&c.r===(group==='SJ'?15:16)).length;
    const eligibleCount=group.length===1?state.hands[0].filter(c=>c.s===group&&c.r===state.level).length:count;
    const option=options.filter(b=>group.length===1?b.trump===group:b.choice===group).at(-1);
    button.disabled=!option;button.querySelector('.bid-count').textContent=count;
    const action=option?(current?(current.player===0?'自保':'反主'):(option.trump==='NT'?'叫无主':'抢主')):eligibleCount?'不可反':group.length===1&&count?'无级牌':'未到手';
    button.querySelector('.bid-action').textContent=action;
    button.setAttribute('aria-label',(group.length===1?E.symbol[group]+' 普通花色牌 '+count+' 张，另有级牌 '+eligibleCount+' 张':(group==='SJ'?'小王':'大王')+' '+count+' 张')+'，'+action);
    button.title=option?(option.cards.length===2?'亮出两张':'亮出一张')+(option.trump==='NT'?'，确定无主':''):group.length===2&&count<2?'需要两张相同的王':current?.player===0?'仅可补同花色对子自保':'需要手中有牌，且档位高于当前亮主';
  });
}
function dealNext(){
  if(state.phase!=='dealing')return;
  if(modalOpen()){dealTimer=setTimeout(dealNext,DEAL_DELAY);return;}
  const player=(state.dealStart+state.dealIndex)%4,card=state.dealCards[state.dealIndex++];
  state.hands[player].push(card);state.lastDealt=player===0?card.id:null;
  if(state.dealIndex===100){
    state.phase='bidding';state.bidSeconds=BID_WINDOW;state.dealCards=[];
    if(state.currentBid?.strength===4){log('发牌完成，双大王无主已是最高档位，直接定主。');finalizeAuction();return;}
    log('发牌完成，每人 25 张；进入 8 秒反主时间。');
    notice('最后反主时间：每次有效反主或自保都会重置为 8 秒。');
    render();auctionTimer=setTimeout(auctionTick,1000);
  }else{render();dealTimer=setTimeout(dealNext,state.fastDeal?35:DEAL_DELAY);}
}
function auctionTick(){
  if(state.phase!=='bidding')return;
  if(!modalOpen()){
    state.bidSeconds--;
    if(state.bidSeconds<=0){finalizeAuction();return;}
    renderAuction();
  }
  auctionTimer=setTimeout(auctionTick,1000);
}
function makeBid(choice,player){
  if(!auctionOpen())return false;
  const error=E.bidError(state.hands[player],choice,state.level,state.currentBid,player);
  if(error){if(player===0)notice(error,true);return false;}
  const previous=state.currentBid,bid={...E.declaration(state.hands[player],choice,state.level),player};
  if(!state.firstBid)state.firstBid=bid;
  if(round===1)state.dealer=player;
  state.currentBid=bid;state.declarations[player]=bid;state.trump=bid.trump;
  const action=previous?(previous.player===player?'自保':'反主'):'抢主';
  log(names[player]+action+'：'+bid.cards.map(c=>E.symbol[c.s]+E.label(c.r)).join(' ')+'，当前 '+trumpName(bid.trump)+'。');
  if(state.phase==='bidding'){state.bidSeconds=BID_WINDOW;clearTimeout(auctionTimer);auctionTimer=setTimeout(auctionTick,1000);}
  notice(names[player]+action+'成功，当前为'+trumpName(bid.trump)+'。');
  if(state.phase==='bidding'&&bid.strength===4){finalizeAuction();return true;}
  render();scheduleBotBid();return true;
}
function scheduleBotBid(){clearTimeout(botBidTimer);if(auctionOpen())botBidTimer=setTimeout(botBidTick,BOT_BID_DELAY);}
function botBidTick(){
  if(!auctionOpen())return;
  if(modalOpen()){scheduleBotBid();return;}
  let best=null;
  for(let player=1;player<4;player++){
    const current=state.currentBid;
    if(current&&current.player!==player&&current.player%2===player%2)continue;
    for(const bid of E.bidOptions(state.hands[player],state.level,current,player)){
      const suited=bid.trump==='NT'?state.hands[player].filter(c=>c.s==='J'||c.r===state.level).length:state.hands[player].filter(c=>c.s===bid.trump).length;
      const score=bid.strength*20+suited;
      if(!best||score>best.score)best={...bid,player,score};
    }
  }
  if(best)makeBid(best.choice,best.player);else scheduleBotBid();
}
function finalizeAuction(){
  if(state.phase!=='bidding'||state.dealIndex!==100)return;
  clearTimeout(dealTimer);clearTimeout(botBidTimer);clearTimeout(auctionTimer);
  if(!state.currentBid){state.trump='NT';log('无人亮主，按约定打无主，原庄家坐庄。');}
  else if(round===1)state.dealer=state.currentBid.player;
  dealer=state.dealer;
  log('定主：'+trumpName(state.trump)+'，由'+names[state.dealer]+'坐庄。');
  $('center').innerHTML='';$('center').className='center-panel';
  state.pickedBottomIds=state.bottom.map(c=>c.id);
  state.hands[state.dealer].push(...state.bottom);state.bottom=[];state.phase='bury';state.turn=state.dealer;state.lastDealt=null;
  render();
  if(state.dealer===0)notice('金色“底”标记为新获得的底牌。请选择 8 张牌埋底，再点击「确认埋底」。');
  else{notice(names[state.dealer]+'正在选择底牌…');timer=setTimeout(()=>bury(autoBottom(state.hands[state.dealer])),1000);}
}
function autoBottom(hand){
  return [...hand].sort((a,b)=>{
    const cost=c=>(E.category(c,state)==='T'?70:0)+E.rank(c,state)+E.points([c])*3+(E.pairs(hand,state).some(p=>p[0].s===c.s&&p[0].r===c.r)?14:0);
    return cost(a)-cost(b);
  }).slice(0,8);
}
function remove(player,cards){const ids=new Set(cards.map(c=>c.id));state.hands[player]=state.hands[player].filter(c=>!ids.has(c.id));}
function bury(cards){
  if(state.phase!=='bury'||cards.length!==8)return;
  state.bottom=cards;remove(state.dealer,cards);if(state.dealer===0)selected.clear();state.phase='playing';state.turn=state.dealer;
  log(names[state.dealer]+'已埋好 8 张底牌，庄家先出。');render();schedule();
}
function schedule(){
  clearTimeout(timer);if(state.phase!=='playing'||replaySnapshot)return;
  if(state.turn===0&&canAutoFinish()){
    notice('最后一轮，系统即将自动出牌…');
    timer=setTimeout(()=>{if(modalOpen()){schedule();return;}playCards(0,[...state.hands[0]]);},650);return;
  }
  if(state.turn===0){notice(state.plays.length?'轮到你：请跟 '+state.plays[0].cards.length+' 张牌。':'轮到你领出：可出单张、对子、拖拉机或同门甩牌。');return;}
  notice(names[state.turn]+'正在思考…');
  timer=setTimeout(()=>{const player=state.turn;playCards(player,E.choose(state.hands[player],state.plays,state,player));},950);
}
function playCards(player,cards){
  if(state.phase!=='playing'||state.turn!==player||replaySnapshot)return;
  const error=E.legal(state.hands[player],cards,state.plays[0]?.cards,state);
  if(error){notice(error,true);return;}
  let throwMessage='',throwFailed=false;
  if(!state.plays.length&&E.shape(cards,state).type==='throw'){
    const attempt=E.checkThrow(cards,state.hands,player,state);throwFailed=!attempt.ok;
    if(!attempt.cards.length){notice(attempt.error,true);return;}
    if(!attempt.ok){
      clearTimeout(timer);
      const ids=new Set(cards.map(c=>c.id)),display=E.sort(state.hands[player],state).filter(c=>ids.has(c.id));
      remove(player,display);if(player===0)selected.clear();state.plays.push({player,cards:display});state.phase='throwing';
      render();notice(names[player]+'正在甩牌，核验中…');
      timer=setTimeout(()=>{
        state.plays.pop();state.hands[player].push(...display);state.phase='playing';
        const message=names[player]+'甩牌失败，多余的牌已退回手中。';
        commitPlay(player,attempt.cards);log(message);notice(message,true);
      },1200);
      return;
    }
    cards=attempt.cards;throwMessage=names[player]+'甩牌成功，共 '+cards.length+' 张。';
    log(throwMessage);
  }
  commitPlay(player,cards);
  if(throwMessage)notice(throwMessage,throwFailed);
}
function commitPlay(player,cards){
  clearTimeout(timer);
  const ids=new Set(cards.map(c=>c.id));cards=E.sort(state.hands[player],state).filter(c=>ids.has(c.id));
  const missing=E.revealedVoid(state.plays[0]?.cards,cards,state);
  state.voids ||= [[],[],[],[]];
  if(missing&&!state.voids[player].includes(missing))state.voids[player].push(missing);
  (state.publicCards ||= []).push(...cards);
  remove(player,cards);if(player===0)selected.clear();state.plays.push({player,cards});
  if(state.plays.length===4){
    state.phase='review';const winner=E.winner(state.plays,state),pts=E.points(state.plays.flatMap(p=>p.cards));
    if(winner%2!==state.dealer%2)addScore(pts);
    log(names[winner]+'赢得第 '+(state.trick+1)+' 轮'+(pts?'，收取 '+pts+' 分':'')+'。');
    render();notice(names[winner]+'赢得本轮'+(pts?' · '+pts+' 分':''));
    scheduleReview();
  }else{state.turn=(player+1)%4;render();schedule();}
}
function canAutoFinish(){
  const hand=state.hands[0];if(hand.length!==1)return false;
  const lead=state.plays[0]?.cards;
  if(lead)return hand.length===lead.length&&!E.legal(hand,hand,lead,state);
  return !!E.shape(hand,state)&&E.checkThrow(hand,state.hands,0,state).ok;
}
function scheduleReview(){
  clearTimeout(timer);if(state.phase!=='review'||replaySnapshot)return;
  timer=setTimeout(()=>{
    const winner=E.winner(state.plays,state);
    state.lastTrick={trick:state.trick,plays:state.plays.map(p=>({player:p.player,cards:[...p.cards]}))};
    if(!state.hands[0].length){finish(winner);return;}
    state.trick++;state.plays=[];state.turn=winner;state.phase='playing';render();schedule();
  },1900);
}
function showPrevious(){
  if(replaySnapshot){returnFromPrevious();return;}
  if(!state.lastTrick||state.phase==='throwing')return;
  endSelectionGesture();clearTimeout(timer);clearTimeout(replayTimer);
  replaySnapshot=state.lastTrick;render();notice('正在展示上一轮四家出牌，2 秒后自动返回，也可点击“返回”。');
  replayTimer=setTimeout(returnFromPrevious,2000);
}
function returnFromPrevious(){
    clearTimeout(replayTimer);
    replaySnapshot=null;render();
    if(state.phase==='playing')schedule();else if(state.phase==='review')scheduleReview();else notice('底牌已自动公开，可继续下一局。');
}
function finish(lastWinner){
  state.phase='over';
  let multiplier=0,bonus=0;
  if(lastWinner%2!==state.dealer%2){
    multiplier=E.bottomMultiplier(state.plays[0].cards,state);
    bonus=E.points(state.bottom)*multiplier;addScore(bonus);
    log('闲家扣底：'+E.points(state.bottom)+' 底分 × '+multiplier+' = '+bonus+' 分。');
  }else log('庄家方守住最后一轮，底牌不计分。');
  const result=E.settle(state.score),winningTeam=result.defend?state.dealer%2:1-state.dealer%2;
  state.matchOver=state.level===14;
  levels[winningTeam]=Math.min(14,levels[winningTeam]+result.steps);dealer=(state.dealer+(result.defend?2:1))%4;
  log((winningTeam===0?'我方':'对方')+(result.defend?'保庄':'上台')+(result.steps?'，升 '+result.steps+' 级':'')+'。');
  render();$('center').className='center-panel result';
  $('center').innerHTML='<span class="eyebrow">'+(state.matchOver?'MATCH COMPLETE':'ROUND COMPLETE')+'</span><h2>'+(state.matchOver?'A 级结束 · 整场完成':(winningTeam===0?'我方':'对方')+(result.defend?'成功保庄':'成功上台'))+'</h2><div class="result-score">'+state.score+' <small style="font-size:12px">分</small></div><p>'+(state.matchOver?'再来一局，双方从 2 重新开始':(result.steps?'获胜方升 '+result.steps+' 级 · ':'')+'下局由'+names[dealer]+'坐庄')+'<br>'+(multiplier?'扣底 '+E.points(state.bottom)+' × '+multiplier+' = '+bonus+' 分':'庄家保底成功')+'</p><button id="next" class="primary">再来一局 →</button>';
  const reveal=document.createElement('section');reveal.className='result-bottom';
  reveal.innerHTML='<h3>本局底牌已亮出 <small>底分 '+E.points(state.bottom)+' 分</small></h3><div id="resultBottomCards" class="bottom-cards"></div>';
  $('center').insertBefore(reveal,$('next'));
  $('resultBottomCards').replaceChildren(...E.sort(state.bottom,state).map(c=>cardElement(c)));
  $('next').onclick=()=>{if(state.matchOver)startMatch();else{round++;newGame();}};
  notice(state.matchOver?'整场游戏结束，点击「再来一局」双方从 2 开始。':'本局底牌已自动公开，点击「再来一局」继续本场升级。');
}
function showBottom(){
  if(state.phase!=='over'&&(state.dealer!==0||auctionOpen()||state.phase==='bury')){
    notice('底牌暂不公开，庄家埋底后可查看自己的底牌，结算后所有人可见。');return;
  }
  $('bottomCards').replaceChildren(...E.sort(state.bottom,state).map(c=>cardElement(c)));
  $('bottomCaption').textContent='共 8 张 · 底分 '+E.points(state.bottom)+' 分';$('bottomDialog').showModal();
}
$('play').onclick=()=>{
  const cards=state.hands[0].filter(c=>selected.has(c.id));if(state.turn!==0)return;
  if(state.phase==='bury'){if(cards.length!==8){notice('需要恰好选择 8 张底牌。',true);return;}bury(cards);}
  else if(state.phase==='playing')playCards(0,cards);
};
$('hint').onclick=()=>{
  if(replaySnapshot||state.turn!==0||!['bury','playing'].includes(state.phase))return;
  const cards=state.phase==='bury'?autoBottom(state.hands[0]):E.choose(state.hands[0],state.plays,state,0);
  selected=new Set(cards.map(c=>c.id));renderHand();notice(state.phase==='bury'?'已选出建议埋底的 8 张牌，可自行调整。':'已选出建议出牌，点击「出牌」确认。');
};
$('pairToggle').onclick=()=>{pairSelection=!pairSelection;syncHandSelection();};
$('previousBtn').onclick=showPrevious;
$('rulesBtn').onclick=()=>$('rules').showModal();$('closeRules').onclick=$('gotRules').onclick=()=>$('rules').close();
$('restart').onclick=()=>$('confirm').showModal();$('cancelRestart').onclick=()=>$('confirm').close();
$('confirmRestart').onclick=()=>{$('confirm').close();startMatch();};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!modalOpen()&&e.target===document.body&&!$('play').disabled)$('play').click();});
function fitGame(){
  const portrait=innerHeight>innerWidth,width=portrait?innerHeight:innerWidth,height=portrait?innerWidth:innerHeight;
  const scale=Math.min(width/1600,height/900);
  $('game').style.transform='translate(-50%,-50%) rotate('+(portrait?90:0)+'deg) scale('+scale+')';
}
window.addEventListener('resize',()=>{endSelectionGesture(true);fitGame();});fitGame();setupHandSelection();
$('logBtn').onclick=()=>$('history').showModal();$('closeHistory').onclick=()=>$('history').close();
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('当前浏览器不支持全屏，可使用浏览器的全屏功能。');}};
$('bottomBtn').onclick=showBottom;$('closeBottom').onclick=()=>$('bottomDialog').close();
$('throwHintToggle').onclick=()=>togglePublicHint('throw');
$('voidHintToggle').onclick=()=>togglePublicHint('void');
$('settingsBtn').onclick=()=>{$('startingLevel').value=String(levels[0]);$('settings').showModal();};
$('closeSettings').onclick=()=>$('settings').close();
$('applySettings').onclick=()=>{const level=Number($('startingLevel').value);if(!Number.isInteger(level)||level<2||level>14)return;$('settings').close();startMatch(level);};
$('testDealToggle').onclick=()=>{TEST_DEAL=!TEST_DEAL;try{localStorage.setItem('tractor-test-deal',String(TEST_DEAL));}catch{}render();notice('测试发牌已'+(TEST_DEAL?'开启':'关闭')+'，下一局开始生效。');};
startMatch();
