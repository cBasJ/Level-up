const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.addInitScript(()=>localStorage.setItem('tractor-progress',JSON.stringify({levels:[9,11],dealer:3,round:8})));
  await page.goto('http://127.0.0.1:4173/index.html?normal=1');
  assert.deepEqual(await page.evaluate(()=>({levels,dealer,round})),{levels:[2,2],dealer:0,round:1},'a fresh match ignores a previous saved dealer');
  const dealDelay=await page.evaluate(()=>DEAL_DELAY);fs.mkdirSync('artifacts',{recursive:true});
  assert.equal(await page.evaluate(()=>state.phase),'dealing');assert.equal(await page.locator('#hand .card').count(),0);
  // Keep a genuine 108-card deck, but put declaration cards early to exercise the UI deterministically.
  await page.evaluate(()=>{
    const deck=E.deck(),prefix=['0-S-2','0-H-2','0-D-2','0-J-15','1-S-2','1-H-2','0-C-2','1-J-15','0-J-16','1-D-2','1-C-2','0-S-3','1-J-16'];
    const arranged=[...prefix.map(id=>deck.find(c=>c.id===id)),...deck.filter(c=>!prefix.includes(c.id))];
    for(let i=0;i<100;i+=4)[arranged[i+1],arranged[i+3]]=[arranged[i+3],arranged[i+1]];
   const original=E.deck;E.deck=()=>arranged.slice();levels=[2,2];round=1;dealer=0;newGame();E.deck=original;
  });
  await page.locator('#rulesBtn').click();await page.clock.runFor(dealDelay*6);
  assert.equal(await page.locator('#hand .card').count(),0,'dealing pauses while reading rules');
  await page.locator('#gotRules').click();await page.clock.runFor(dealDelay);
  assert.equal(await page.locator('#hand .card').count(),1);
  await page.locator('[data-bidgroup="S"]').click();
  assert.equal(await page.evaluate(()=>state.currentBid.strength),1);
  assert.equal(await page.evaluate(()=>state.firstBid.player),0);
  await page.clock.runFor(dealDelay*7);
  assert.equal(await page.locator('[data-bidgroup="S"]').isEnabled(),true,'can reinforce when second suited level arrives');
  // Opponent counters with two level cards, another opponent counters with small jokers.
  assert.equal(await page.evaluate(()=>makeBid('H2',1)),true);
  assert.equal(await page.locator('[data-bidgroup="S"]').isEnabled(),false,'equal-strength pair cannot counter');
  await page.clock.runFor(0);
  assert.equal(await page.evaluate(()=>makeBid('SJ',3)),true);
  assert.equal(await page.locator('#trump').textContent(),'无主');
  await page.clock.runFor(dealDelay*5);
  await page.locator('[data-bidgroup="BJ"]').click();
  assert.equal(await page.evaluate(()=>state.currentBid.strength),4);
  assert.equal(await page.evaluate(()=>state.hands[0].length),4,'declarations do not consume cards');
  assert.equal(await page.evaluate(()=>state.dealer),0,'final big-joker caller becomes dealer');
  await page.locator('#bottomBtn').click();assert.equal(await page.locator('#bottomDialog').evaluate(d=>d.open),false);
  await page.clock.runFor(dealDelay*72);await page.screenshot({path:'artifacts/dealing.png',fullPage:true});
  for(const suit of ['S','H','C','D']){
    const held=await page.evaluate(s=>state.hands[0].filter(c=>c.s===s&&c.r!==state.level).length,suit);
    assert.equal(await page.locator('[data-bidgroup="'+suit+'"] .bid-count').textContent(),String(held));
  }
  await page.locator('#rulesBtn').click();const before=await page.evaluate(()=>state.dealIndex);
  await page.clock.runFor(3000);assert.equal(await page.evaluate(()=>state.dealIndex),before);
  await page.locator('#closeRules').click();
  await page.clock.runFor(dealDelay*15);
  assert.equal(await page.evaluate(()=>state.phase),'bury','double big joker skips the counter window after dealing finishes');
  assert.deepEqual(await page.evaluate(()=>state.hands.map(h=>h.length)),[33,25,25,25]);
  assert.equal(await page.evaluate(()=>state.bottom.length),0);
  assert.equal(await page.locator('#hand .card').count(),33);
  assert.ok(await page.locator('#hand .card').evaluateAll(cards=>cards.every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})));
  await page.locator('#hint').click();assert.equal(await page.locator('#hand .selected').count(),8);
  await page.clock.runFor(180);
  assert.ok(await page.locator('#hand .card').evaluateAll(cards=>cards.every(c=>{const r=c.getBoundingClientRect();return document.elementFromPoint(r.left+12,r.top+18)?.closest('.card')===c;})));
  await page.screenshot({path:'artifacts/bury.png',fullPage:true});
  await page.locator('#play').click();assert.equal(await page.locator('#hand .card').count(),25);
  assert.equal(await page.locator('.played .card').count(),0);await page.clock.runFor(1200);
  // Lead a scoring card: table total and winning badge must update before the next player.
  const lead=await page.evaluate(()=>state.hands[0].find(c=>E.points([c])>0)||state.hands[0][0]);
  await page.locator('#hand [data-id="'+lead.id+'"]').click({position:{x:10,y:15},modifiers:['Shift']});
  await page.locator('#play').click();
  assert.equal(await page.evaluate(()=>state.turn),3,'human play passes counterclockwise to the right-hand player');
  assert.equal(await page.locator('.played.is-winning').getAttribute('id'),'play0');
  assert.equal(await page.locator('#trickCount').textContent(),'第 1 轮');
  assert.equal(await page.locator('#tablePoints').textContent(),String(lead.r===5?5:lead.r===10||lead.r===13?10:0));
  await page.clock.runFor(950);await page.screenshot({path:'artifacts/trick-leading.png',fullPage:true});
  let checkedReview=false,checkedNewRound=false;
  for(let n=0;n<300;n++){
    const phase=await page.evaluate(()=>state.phase);if(phase==='over')break;
    const expected=await page.evaluate(()=>({points:E.points(state.plays.flatMap(p=>p.cards)),best:state.plays.length?E.winner(state.plays,state):null,trick:state.trick}));
    assert.equal(await page.locator('#tablePoints').textContent(),String(expected.points));
    assert.equal(await page.locator('.winner-badge').count(),expected.best===null?0:1);
    if(expected.best!==null)assert.equal(await page.locator('.played.is-winning').getAttribute('id'),'play'+expected.best);
    if(phase==='review'&&!checkedReview){
      assert.match(await page.locator('.winner-badge').textContent(),/本轮最大/);
      await page.screenshot({path:'artifacts/trick-complete.png',fullPage:true});checkedReview=true;
    }
    if(expected.trick>0&&!expected.points&&!await page.locator('.winner-badge').count())checkedNewRound=true;
    if(await page.locator('#hint').isEnabled()){await page.locator('#hint').click();await page.locator('#play').click();}
    else await page.clock.runFor(950);
  }
  assert.equal(await page.evaluate(()=>state.phase),'over');assert.ok(checkedReview);assert.ok(checkedNewRound);
  assert.equal(await page.locator('#resultBottomCards .card').count(),8,'bottom cards automatically revealed without a click');
  assert.equal(await page.locator('#resultBottomCards').isVisible(),true);
  const nextDealer=await page.evaluate(()=>dealer),nextLevels=await page.evaluate(()=>levels.slice());
  assert.equal(await page.locator('#revealBottom').count(),0);assert.equal(await page.locator('.played .card').count(),0);await page.clock.runFor(1200);
  await page.screenshot({path:'artifacts/result.png',fullPage:true});
  await page.locator('#next').click();assert.equal(await page.evaluate(()=>state.phase),'dealing');assert.equal(await page.locator('#roundTitle').textContent(),'第 2 局');
  assert.equal(await page.evaluate(()=>state.dealer),nextDealer);assert.deepEqual(await page.evaluate(()=>levels),nextLevels);
  await page.locator('#restart').click();await page.locator('#cancelRestart').click();assert.equal(await page.evaluate(()=>state.phase),'dealing');
  await page.locator('#passBid').click();await page.clock.runFor(5000);assert.ok(['bidding','bury','playing','review'].includes(await page.evaluate(()=>state.phase)));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#rulesBtn').click();assert.equal(await page.locator('#rules').evaluate(d=>d.open),true);await page.locator('#closeRules').click();
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:'artifacts/mobile-landscape.png',fullPage:true});
  assert.ok(await page.locator('#game').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;}));
  await page.locator('#restart').click();await page.locator('#confirmRestart').click();
  assert.deepEqual(await page.evaluate(()=>({levels,dealer,round})),{levels:[2,2],dealer:0,round:1});
  assert.equal(await page.evaluate(()=>state.firstBid),null);
  await page.reload();assert.equal(await page.locator('#roundTitle').textContent(),'第 1 局');
  assert.deepEqual(await page.evaluate(()=>levels),[2,2]);
  assert.deepEqual(errors,[]);
  console.log('Browser passed: progressive dealing, live counter-bids, no trump, final-caller dealer, dialogs pause auction, 33-card bury, full game, winner markers and table points, next round, restart, portrait/landscape.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
