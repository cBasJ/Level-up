const {chromium}=require('@playwright/test');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('http://127.0.0.1:4173/index.html');
  assert.match(await page.locator('.local-label').textContent(),/测试发牌/);
  assert.equal(await page.evaluate(()=>{
   clearTimers();
   for(let level=2;level<=14;level++)for(let start=0;start<4;start++)for(let n=0;n<8;n++){
    const cards=prepareTestDeal(E.deck(),start,level),hand=cards.slice(0,100).filter((c,i)=>(start+3*i)%4===0);
    if(cards.length!==108||new Set(cards.map(c=>c.id)).size!==108||hand.length!==25||!hand.some(c=>c.s==='J'&&c.r===16))return false;
    for(const trump of [...E.SUITS,'NT'])if(E.tractorIds(hand,{level,trump}).size<4)return false;
   }return true;
  }),true);
  await page.locator('#rulesBtn').click();await page.locator('#closeRules').click();
  assert.equal(await page.evaluate(()=>scoreAudio.state),'running');
  // Exercise actual oscillator scheduling, and record thresholds without muting audio.
  await page.evaluate(()=>{window.chimes=[];const original=GameAudio.score;GameAudio.score=n=>{chimes.push(n);original(n);};state.score=75;addScore(5);});
  assert.deepEqual(await page.evaluate(()=>chimes),[80]);assert.equal(await page.locator('#scoreCelebration').evaluate(el=>el.classList.contains('show')),true);
  await page.clock.runFor(350);await page.screenshot({path:'artifacts/score-80.png',fullPage:true});
  await page.clock.runFor(2050);assert.equal(await page.locator('#scoreCelebration').evaluate(el=>el.classList.contains('show')),false);
  await page.evaluate(()=>{addScore(5);addScore(35);addScore(60);addScore(0);});assert.deepEqual(await page.evaluate(()=>chimes),[80,120,160]);
  await page.evaluate(()=>{newGame();clearTimers();chimes.length=0;addScore(200);});assert.deepEqual(await page.evaluate(()=>chimes),[80,120,160]);
  await page.evaluate(()=>newGame());assert.equal(await page.locator('#scoreCelebration').evaluate(el=>el.classList.contains('show')),false);
  assert.deepEqual(errors,[]);console.log('Score thresholds, real audio scheduling, animation cleanup, and 416 test deals across all levels/seats passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
