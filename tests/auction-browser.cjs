const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.goto('http://127.0.0.1:4173/index.html?normal=1');
  const dealDelay=await page.evaluate(()=>DEAL_DELAY);
  // Only human spade pair and AI 1 heart single can bid; remaining level cards are in bottom.
  async function controlledDeal(){await page.evaluate(()=>{
   const all=E.deck(),ids=['0-S-2','0-H-2','0-J-15','0-J-16','1-S-2','1-J-15','1-J-16'];
   const bottomIds=['1-H-2','0-C-2','1-C-2','0-D-2','1-D-2','0-D-3','0-D-4','0-D-5'];
   const ordered=[...ids.map(id=>all.find(c=>c.id===id)),...all.filter(c=>!ids.includes(c.id)&&!bottomIds.includes(c.id)),...bottomIds.map(id=>all.find(c=>c.id===id))];
   for(let i=0;i<100;i+=4)[ordered[i+1],ordered[i+3]]=[ordered[i+3],ordered[i+1]];
   const original=E.deck;E.deck=()=>ordered.slice();levels=[2,2];dealer=0;round=1;newGame();E.deck=original;
  });}
  await controlledDeal();await page.clock.runFor(dealDelay);await page.locator('[data-bidgroup="S"]').click();
  await page.clock.runFor(dealDelay*4);assert.match(await page.locator('[data-bidgroup="S"]').getAttribute('aria-label'),/自保/);
  assert.equal(await page.locator('.bid-action').count(),0);assert.equal(await page.locator('.suit-options > button:last-child').getAttribute('id'),'passBid');assert.equal(await page.locator('#passBid').textContent(),'不叫');
  await page.locator('[data-bidgroup="S"]').click();assert.equal(await page.evaluate(()=>state.currentBid.strength),2);
  assert.equal(await page.evaluate(()=>state.hands[0].length),2);
  await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>state.currentBid.player),0,'reinforcement prevents equal/lower counter');
  await controlledDeal();await page.clock.runFor(dealDelay*100+7000);
  assert.equal(await page.evaluate(()=>state.phase),'bidding');assert.equal(await page.evaluate(()=>state.bidSeconds),1);
  assert.equal(await page.evaluate(()=>state.currentBid.player),1,'AI actually grabs trump while dealing');
  await page.locator('[data-bidgroup="S"]').click();
  assert.equal(await page.evaluate(()=>state.bidSeconds),8,'late counter resets the full window');
  assert.equal(await page.evaluate(()=>state.dealer),0,'successful counter transfers dealer');
  await page.clock.runFor(7000);assert.equal(await page.evaluate(()=>state.phase),'bidding');
  await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>state.phase),'bury');
  assert.equal(await page.evaluate(()=>makeBid('S2',0)),false,'closed auction rejects subsequent bids');
  // All eight levels are in the bottom and jokers split across players: no valid declaration.
  await page.evaluate(()=>{
   const all=E.deck(),jokerIds=['0-J-15','1-J-15','0-J-16','1-J-16'];
   const ordered=[...jokerIds.map(id=>all.find(c=>c.id===id)),...all.filter(c=>c.r!==2&&c.s!=='J'),...all.filter(c=>c.r===2)];
   for(let i=0;i<100;i+=4)[ordered[i+1],ordered[i+3]]=[ordered[i+3],ordered[i+1]];
   const original=E.deck;E.deck=()=>ordered.slice();dealer=0;round=1;levels=[2,2];newGame();E.deck=original;
  });
  await page.clock.runFor(dealDelay*100+8000);
  assert.equal(await page.evaluate(()=>state.phase),'bury');assert.equal(await page.evaluate(()=>state.trump),'NT');
  assert.equal(await page.evaluate(()=>state.currentBid),null);assert.equal(await page.evaluate(()=>state.hands[0].length),33);
  assert.equal(await page.evaluate(()=>state.hands.flat().length+state.bottom.length),108);
  // Restart must cancel the preceding auction and bot timers.
  await controlledDeal();await page.clock.runFor(100);await controlledDeal();await page.clock.runFor(dealDelay);
  assert.equal(await page.evaluate(()=>state.hands.flat().length),1);
  await page.clock.runFor(dealDelay*99);assert.deepEqual(await page.evaluate(()=>state.hands.map(h=>h.length)),[25,25,25,25]);
  assert.deepEqual(errors,[]);
  console.log('Auction edge cases passed: self reinforcement, real AI grab, late counter clock reset, no post-bottom counter, no-bid no-trump fallback, restart timer cancellation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
