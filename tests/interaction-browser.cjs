const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('http://127.0.0.1:4173/index.html?normal=1');fs.mkdirSync('artifacts',{recursive:true});
  async function fixture(options){return page.evaluate(opts=>{
   newGame();clearTimers();selected.clear();pairSelection=true;
   const pool=E.deck();const take=spec=>{const index=pool.findIndex(c=>c.s===spec[0]&&c.r===spec[1]);if(index<0)throw Error('Duplicate fixture card');return pool.splice(index,1)[0];};
   state.phase=opts.phase||'playing';state.trump=opts.trump||'H';state.level=opts.level||2;state.turn=0;state.dealer=0;state.trick=opts.trick||0;state.dealIndex=100;state.lastDealt=null;
   state.hands=(opts.hands||[opts.hand,[['C',3]],[['D',3]],[['C',4]]]).map(h=>h.map(take));
   state.plays=(opts.plays||[]).map(p=>({player:p.player,cards:p.cards.map(take)}));
   state.lastTrick=opts.lastTrick?{trick:0,plays:opts.lastTrick.map(p=>({player:p.player,cards:p.cards.map(take)}))}:null;
   state.bottom=pool.slice(0,8);$('center').className='center-panel';$('center').innerHTML='';if(auctionOpen())showBid();render();
   return E.sort(state.hands[0],state).map(c=>({id:c.id,s:c.s,r:c.r}));
  },options);}
  async function clickSetting(id){await page.locator('#settingsBtn').click();await page.locator('#'+id).click();await page.locator('#closeSettings').click();}
  async function clickCard(id){await page.locator('#hand [data-id="'+id+'"]').click({position:{x:9,y:13}});}
  async function selectedIds(){return page.evaluate(()=>[...selected].sort());}
  async function point(index,portrait=false){return page.locator('#hand .card').nth(index).evaluate((el,p)=>{const r=el.getBoundingClientRect();return p?{x:r.right-8,y:r.top+6}:{x:r.left+10,y:r.top+15};},portrait);}
  const hand=[['S',14],['S',14],['S',13],['S',13],['S',11],['C',6],['H',2],['J',15],['J',16],['H',9],['C',2]];
  let cards=await fixture({hand});
  assert.equal(await page.locator('#hand .double-stars').count(),3);assert.equal(await page.locator('#hand .tractor-mark').count(),4);
  const ace=cards.find(c=>c.s==='S'&&c.r===14);await clickCard(ace.id);assert.equal((await selectedIds()).length,2);await clickCard(ace.id);assert.equal((await selectedIds()).length,0);
  await page.locator('#pairToggle').click();assert.match(await page.locator('#pairToggle').textContent(),/单张/);
  const from=await point(0),to=await point(4);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
  assert.deepEqual(await selectedIds(),cards.slice(0,5).map(c=>c.id).sort());
  const reverse=await point(4),back=await point(0);await page.mouse.move(reverse.x,reverse.y);await page.mouse.down();await page.mouse.move(back.x,back.y,{steps:8});await page.mouse.up();assert.equal((await selectedIds()).length,0);
  const start=await point(1),far=await point(5),near=await point(3);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(far.x,far.y);await page.mouse.move(near.x,near.y);await page.mouse.up();assert.deepEqual(await selectedIds(),cards.slice(1,4).map(c=>c.id).sort());
  // Hint applies only to a legal, strictly winning response and sits below the action buttons.
  cards=await fixture({hand:[['S',10],['S',8],['S',9],['C',14],['C',14]],plays:[{player:3,cards:[['S',9]]}]});
  await clickCard(cards.find(c=>c.r===10).id);assert.equal(await page.locator('#selectionNotice').textContent(),'您选取的牌大于其他玩家');
  const hintBox=await page.locator('#selectionNotice').boundingBox(),actions=await page.locator('.action-bar').boundingBox();assert.ok(hintBox.y>=actions.y+actions.height);
  await page.screenshot({path:'artifacts/selection-winning.png',fullPage:true});
  await clickCard(cards.find(c=>c.s==='C').id);assert.equal((await selectedIds()).length,1,'single-card follow still selects just one from a pair');assert.equal(await page.locator('#selectionNotice').textContent(),'');
  await clickCard(cards.find(c=>c.s==='S'&&c.r===9).id);assert.equal(await page.locator('#selectionNotice').textContent(),'','equal card cannot win a tie');
  // Throw lead commits cards in the same visible order as the hand.
  cards=await fixture({hands:[[['S',12],['S',14],['S',13],['C',6]],[['S',11],['S',10],['D',7],['D',8]],[['S',9],['S',8],['C',7],['C',8]],[['S',7],['S',6],['H',8],['H',9]]]});
  for(const c of cards.filter(c=>c.s==='S').reverse())await clickCard(c.id);
  const expected=cards.filter(c=>c.s==='S').map(c=>c.id);await page.locator('#play').click();assert.deepEqual(await page.evaluate(()=>state.plays[0].cards.map(c=>c.id)),expected);assert.match(await page.locator('#notice').textContent(),/甩牌成功/);
  await page.clock.runFor(950*3);assert.equal(await page.evaluate(()=>state.phase),'review');assert.equal(await page.locator('#play1 .card').count(),3);
  await page.screenshot({path:'artifacts/throw-round.png',fullPage:true});
  cards=await fixture({hands:[[['S',14],['S',9],['C',6]],[['S',13],['D',8],['D',9]],[['C',7],['C',8],['C',9]],[['D',3],['D',4],['D',6]]]});
  for(const c of cards.filter(c=>c.s==='S'))await clickCard(c.id);await page.locator('#play').click();assert.equal(await page.locator('#play0 .card').count(),2);assert.equal(await page.locator('#hand .card').count(),1);assert.equal(await page.evaluate(()=>state.phase),'throwing');await page.clock.runFor(1200);assert.equal(await page.locator('#hand .card').count(),2);assert.equal(await page.locator('#play0 .card').count(),1);assert.equal(await page.evaluate(()=>state.plays[0].cards[0].r),9);assert.match(await page.locator('#notice').textContent(),/甩牌失败/);
  // Previous-trick playback must pause the live game and restore it after exactly 2 seconds.
  await fixture({hand:[['D',8],['D',9],['C',6]],trick:1,plays:[{player:3,cards:[['D',5]]}],lastTrick:[{player:0,cards:[['S',5]]},{player:1,cards:[['S',10]]},{player:2,cards:[['S',13]]},{player:3,cards:[['S',14]]}]});
  const live=await page.evaluate(()=>JSON.stringify({plays:state.plays,hands:state.hands,score:state.score,turn:state.turn}));
  await page.locator('#previousBtn').click();assert.equal(await page.locator('.played .card').count(),4);assert.equal(await page.locator('#tablePoints').textContent(),'25');assert.match(await page.locator('#trickCount').textContent(),/回看.*1/);assert.equal(await page.locator('#hint').isEnabled(),false);
  await page.screenshot({path:'artifacts/previous-trick.png',fullPage:true});await page.clock.runFor(1999);assert.equal(await page.evaluate(()=>!!replaySnapshot),true);
  await page.clock.runFor(1);assert.equal(await page.evaluate(()=>!!replaySnapshot),false);assert.equal(await page.locator('.played .card').count(),1);assert.equal(await page.locator('#tablePoints').textContent(),'5');assert.equal(await page.evaluate(()=>JSON.stringify({plays:state.plays,hands:state.hands,score:state.score,turn:state.turn})),live);
  await fixture({hands:[[['C',6],['D',8]],[['D',9],['D',10]],[['D',11],['D',12]],[['D',13],['D',14]]],trick:1,plays:[{player:0,cards:[['D',5]]}],lastTrick:[{player:0,cards:[['S',5]]},{player:1,cards:[['S',10]]},{player:2,cards:[['S',13]]},{player:3,cards:[['S',14]]}]});
  await page.evaluate(()=>{state.turn=1;render();schedule();});await page.locator('#previousBtn').click();
  await page.clock.runFor(2000);assert.equal(await page.evaluate(()=>state.plays.length),1,'AI waits during playback');
  await page.clock.runFor(950);assert.equal(await page.evaluate(()=>state.plays.length),2,'AI resumes only after returning to live table');
  await page.locator('#previousBtn').click();await page.clock.runFor(100);assert.match(await page.locator('#previousBtn').textContent(),/返回/);await page.locator('#previousBtn').click();assert.equal(await page.evaluate(()=>!!replaySnapshot),false);
  // Last trick auto-plays without selection or pressing Play.
  await fixture({hands:[[['D',9]],[],[],[]],plays:[{player:1,cards:[['D',3]]},{player:2,cards:[['D',4]]},{player:3,cards:[['D',5]]}]});
  await page.evaluate(()=>schedule());await page.clock.runFor(650);assert.equal(await page.evaluate(()=>state.phase),'review');assert.equal(await page.locator('#hand .card').count(),0);assert.equal(await page.locator('#play0 .card').count(),1);
  // Follow-suit dimming leaves legal discards bright when short or void.
  await fixture({hand:[['S',9],['H',9],['C',2]],plays:[{player:1,cards:[['S',8]]}]});
  assert.equal(await page.locator('#hand .off-suit').count(),2);
  await fixture({hand:[['S',9],['H',9],['C',2]],plays:[{player:1,cards:[['H',8]]}]});
  assert.equal(await page.locator('#hand .off-suit').count(),1);
  await fixture({hand:[['S',9],['H',9],['C',2]],plays:[{player:1,cards:[['S',8],['S',8]]}]});
  assert.equal(await page.locator('#hand .off-suit').count(),0);
  await fixture({hand:[['D',9],['H',9]],plays:[{player:1,cards:[['S',8]]}]});
  assert.equal(await page.locator('#hand .off-suit').count(),0);
  // Counter preserves the scheduled dealer beyond round one, and acquired bottom cards are marked until buried.
  await fixture({phase:'bidding',hands:[[['H',2],['H',2]],[['S',2]],[['J',15],['J',15]],[['J',16],['J',16]]]});
  await page.evaluate(()=>{round=2;state.currentBid=null;state.firstBid=null;makeBid('H2',0);makeBid('SJ',2);clearTimeout(botBidTimer);finalizeAuction();});
  assert.equal(await page.evaluate(()=>state.dealer),0);assert.equal(await page.locator('#hand .picked-bottom').count(),8);
  assert.equal(await page.locator('#hand .bottom-pick-mark').count(),8);
  await page.screenshot({path:'artifacts/acquired-bottom.png',fullPage:true});
  await page.evaluate(()=>bury(state.hands[0].slice(0,8)));assert.equal(await page.locator('#hand .picked-bottom').count(),0);
  await fixture({phase:'bidding',hands:[[['S',2]],[['H',2],['H',2]],[['J',15],['J',15]],[['J',16],['J',16]]]});
  await page.evaluate(()=>{round=1;state.currentBid=null;state.firstBid=null;makeBid('S1',0);makeBid('H2',1);makeBid('SJ',2);makeBid('BJ',3);});
  assert.equal(await page.evaluate(()=>state.dealer),3);assert.equal(await page.evaluate(()=>state.trump),'NT');assert.equal(await page.evaluate(()=>state.hands[3].length),10);
  // Highest declaration also skips an already-running post-deal bidding window.
  await fixture({phase:'bidding',hand:[['J',16],['J',16],['S',6]]});await page.evaluate(()=>{state.currentBid=null;state.firstBid=null;showBid();render();});await page.locator('[data-bidgroup="BJ"]').click();assert.equal(await page.evaluate(()=>state.phase),'bury');
  // Suit counters exclude level cards but include ordinary trump-suit cards, but joker counters remain actual holdings.
  await fixture({phase:'bidding',hand:[['S',2],['S',8],['H',5],['H',2],['J',15]],trump:'H'});await page.evaluate(()=>{showBid();render();});
  assert.equal(await page.locator('[data-bidgroup="S"] .bid-count').textContent(),'1');assert.equal(await page.locator('[data-bidgroup="H"] .bid-count').textContent(),'1');assert.equal(await page.locator('[data-bidgroup="SJ"] .bid-count').textContent(),'1');
  // A pair must still be played manually; preselection survives another player's move.
  await fixture({hand:[['S',14],['S',14]]});await page.evaluate(()=>schedule());await page.clock.runFor(1000);
  assert.equal(await page.evaluate(()=>state.hands[0].length),2);assert.equal(await page.evaluate(()=>state.plays.length),0);
  cards=await fixture({hands:[[['D',9],['D',10],['C',6]],[['S',9]],[['S',10]],[['S',11]]]});
  await page.evaluate(()=>{state.turn=1;render();});await clickCard(cards[0].id);
  assert.equal(await page.locator('#play').isEnabled(),false);assert.deepEqual(await selectedIds(),[cards[0].id]);
  await page.evaluate(()=>commitPlay(1,[state.hands[1][0]]));assert.deepEqual(await selectedIds(),[cards[0].id]);
  // New public information creates hints; hidden hands and hidden bottom cannot affect them.
  await fixture({hand:[['S',14],['S',13],['D',8]]});assert.equal(await page.locator('#hand .throw-mark').count(),0);
  await page.evaluate(()=>{state.publicCards=E.deck().filter(c=>c.s==='S'&&c.r===14&&!state.hands[0].some(h=>h.id===c.id));render();});
  assert.equal(await page.locator('#hand .throw-mark').count(),2);
  await page.evaluate(()=>{state.hands[1]=[];state.bottom=[];render();});assert.equal(await page.locator('#hand .throw-mark').count(),2);
  await clickSetting('throwHintToggle');assert.equal(await page.locator('#hand .throw-mark').count(),0);
  assert.equal(await page.locator('#voidHintToggle').getAttribute('aria-pressed'),'true');
  await clickSetting('throwHintToggle');assert.equal(await page.locator('#hand .throw-mark').count(),2);
  // Off-suit following proves a void, which persists across trick transitions.
  await fixture({hands:[[['S',10],['D',8]],[['D',9],['D',10]],[['S',11],['D',11]],[['S',12],['D',12]]],plays:[{player:0,cards:[['S',9]]}]});
  await page.evaluate(()=>{state.turn=1;commitPlay(1,[state.hands[1][0]]);clearTimeout(timer);});assert.equal(await page.locator('#player1 .void-suits').textContent(),'♠');
  await page.evaluate(()=>{state.plays=[];state.trick++;render();});assert.equal(await page.locator('#player1 .void-suits').textContent(),'♠');
  await fixture({hands:[[['H',10],['D',8]],[['S',9],['D',10]],[['S',11]],[['S',12]]],plays:[{player:0,cards:[['H',9]]}]});
  await page.evaluate(()=>{state.turn=1;commitPlay(1,[state.hands[1][0]]);clearTimeout(timer);});assert.equal(await page.locator('#player1 .void-red').textContent(),'主');
  await clickSetting('voidHintToggle');assert.equal(await page.locator('.void-suits').count(),0);
  assert.equal(await page.locator('#throwHintToggle').getAttribute('aria-pressed'),'true');
  await clickSetting('voidHintToggle');assert.equal(await page.locator('#player1 .void-red').textContent(),'主');
  await page.screenshot({path:'artifacts/void-hints.png',fullPage:true});
  await page.evaluate(()=>newGame());assert.equal(await page.locator('.void-suits').count(),0);
  // Selection replacement and mandatory-card locking work without a Clear button.
  assert.equal(await page.locator('#clear').count(),0);
  cards=await fixture({hand:[['S',9],['S',10],['D',6]],plays:[{player:1,cards:[['S',8]]}]});
  await clickCard(cards.find(c=>c.r===9).id);await clickCard(cards.find(c=>c.r===10).id);
  assert.deepEqual(await selectedIds(),[cards.find(c=>c.r===10).id]);
  cards=await fixture({hand:[['S',9],['S',9],['S',10],['S',10],['D',6]],plays:[{player:1,cards:[['S',8],['S',8]]}]});
  await clickCard(cards.find(c=>c.r===9).id);await clickCard(cards.find(c=>c.r===10).id);
  assert.deepEqual(await selectedIds(),cards.filter(c=>c.r===10).map(c=>c.id).sort());
  cards=await fixture({hand:[['S',9],['S',9],['S',10],['D',6]],plays:[{player:1,cards:[['S',8],['S',8]]}]});
  const forced=cards.filter(c=>c.r===9).map(c=>c.id).sort();assert.deepEqual(await selectedIds(),forced);
  await clickCard(forced[0]);assert.deepEqual(await selectedIds(),forced);await clickCard(cards.find(c=>c.r===10).id);assert.deepEqual(await selectedIds(),forced);
  assert.equal(await page.locator('#hand .forced-card').count(),2);
  cards=await fixture({hand:[['S',9],['D',10],['C',6]],plays:[{player:1,cards:[['S',8],['S',8]]}]});
  assert.deepEqual(await selectedIds(),[cards.find(c=>c.s==='S').id]);await clickCard(cards.find(c=>c.s==='D').id);assert.equal((await selectedIds()).length,2);
  await page.screenshot({path:'artifacts/forced-selection.png',fullPage:true});
  // Final bidder's cards stay on their avatar, and the prominent auction area contains no level card.
  await fixture({phase:'bidding',hands:[[['S',2]],[['H',2],['H',2]],[['J',15],['J',15]],[['J',16],['J',16]]]});
  await page.evaluate(()=>{round=2;state.currentBid=null;state.firstBid=null;makeBid('S1',0);makeBid('H2',1);});
  assert.equal(await page.locator('.auction-feature #bidCards .card').count(),2);assert.equal(await page.locator('.level-card,.auction-current').count(),0);
  await page.screenshot({path:'artifacts/auction-feature.png',fullPage:true});
  await page.evaluate(()=>finalizeAuction());assert.equal(await page.locator('#player1 .final-bid .card').count(),2);assert.equal(await page.evaluate(()=>state.dealer),0);
  await page.screenshot({path:'artifacts/final-bid-avatar.png',fullPage:true});
  const beforeSwitch=await page.evaluate(()=>JSON.stringify(state.hands));await clickSetting('testDealToggle');assert.equal(await page.evaluate(()=>JSON.stringify(state.hands)),beforeSwitch);
  assert.equal(await page.locator('#testDealToggle').getAttribute('aria-pressed'),'true');
  await page.goto('http://127.0.0.1:4173/index.html');assert.equal(await page.locator('#testDealToggle').getAttribute('aria-pressed'),'true');
  await clickSetting('testDealToggle');await page.reload();assert.equal(await page.locator('#testDealToggle').getAttribute('aria-pressed'),'false');
  // Real touch gestures work on the rotated portrait game, including cancelled touches.
  await page.setViewportSize({width:390,height:844});cards=await fixture({hand});await page.evaluate(()=>{pairSelection=false;syncHandSelection();});
  const a=await point(1,true),b=await point(4,true),cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.deepEqual(await selectedIds(),cards.slice(1,5).map(c=>c.id).sort());
  const original=await selectedIds(),p0=await point(0,true),p2=await point(2,true);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p0,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p2,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await selectedIds(),original);
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:'artifacts/hand-features-mobile.png',fullPage:true});
  await clickSetting('throwHintToggle');await clickSetting('voidHintToggle');await page.reload();
  assert.equal(await page.locator('#throwHintToggle').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#voidHintToggle').getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);console.log('Interactions passed: click/pair/range/touch/cancel, higher-card hint, stars/tractors, throws/failure/follow/order, replay pause/restore, final auto-play, highest-bid fast lock, nontrump counts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
