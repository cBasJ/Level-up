const {chromium}=require('@playwright/test'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('http://127.0.0.1:4173/?normal=1');
  await page.locator('#settingsBtn').click();assert.equal(await page.locator('#settings .hint-controls button').count(),3);
  await page.locator('#startingLevel').selectOption('14');await page.screenshot({path:'artifacts/settings-panel.png',fullPage:true});await page.locator('#applySettings').click();
  assert.deepEqual(await page.evaluate(()=>({levels,round,level:state.level,score:state.score})),{levels:[14,2],round:1,level:14,score:0});
  async function finishAt(level,score){await page.evaluate(({level,score})=>{
   clearTimers();levels=[level,2];state.level=level;state.dealer=0;state.trump='H';state.score=score;state.bottom=E.deck().slice(0,8);state.hands=[[],[],[],[]];
   state.plays=[{player:0,cards:[{id:'last',s:'S',r:9}]}];finish(0);
  },{level,score});}
  await finishAt(14,0);assert.equal(await page.locator('#revealBottom').count(),0);assert.equal(await page.locator('#resultBottomCards .card').count(),8);
  assert.match(await page.locator('#center h2').textContent(),/整场完成/);assert.deepEqual(await page.evaluate(()=>levels),[14,2]);
  await page.screenshot({path:'artifacts/match-complete.png',fullPage:true});await page.locator('#next').click();assert.deepEqual(await page.evaluate(()=>({levels,round,level:state.level})),{levels:[2,2],round:1,level:2});
  await finishAt(13,0);assert.equal(await page.evaluate(()=>state.matchOver),false);assert.equal(await page.evaluate(()=>levels[0]),14);await page.locator('#next').click();assert.equal(await page.evaluate(()=>state.level),14);
  await finishAt(14,80);assert.equal(await page.evaluate(()=>state.matchOver),true);await page.locator('#next').click();assert.deepEqual(await page.evaluate(()=>levels),[2,2]);
  assert.deepEqual(errors,[]);console.log('Settings restart, custom level, A cap/end/reset, and single bottom reveal passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
