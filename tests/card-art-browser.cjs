const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.goto('http://127.0.0.1:4173/index.html?normal=1');
  const names=fs.readdirSync('assets/cards').filter(n=>n.endsWith('.png'));assert.equal(names.length,55);
  const decoded=await page.evaluate(async names=>Promise.all(names.map(async name=>{const image=new Image();image.src='assets/cards/'+name;await image.decode();return {name,ratio:image.naturalWidth/image.naturalHeight};})),names);
  for(const image of decoded)assert.ok(Math.abs(image.ratio-2/3)<.001,image.name+' must be 2:3');
  await page.evaluate(()=>{clearTimers();state.hands[0]=[{id:'x',s:'S',r:2},{id:'y',s:'S',r:2},{id:'j1',s:'J',r:16},{id:'j2',s:'J',r:16}];state.phase='bidding';state.currentBid=null;showBid();render();});
  await page.locator('#passBid').click();assert.equal(await page.locator('#passBid').textContent(),'已不叫');assert.equal(await page.locator('[data-bidgroup]:enabled').count(),0);assert.equal(await page.evaluate(()=>makeBid('BJ',0)),false);
  await page.evaluate(()=>{newGame();clearTimers();state.phase='bidding';state.hands[0]=[{id:'x',s:'S',r:2}];render();});assert.equal(await page.evaluate(()=>makeBid('S1',0)),true);
  await page.evaluate(()=>{clearTimers();state.phase='playing';state.trump='H';state.hands[0]=E.deck().slice(0,25);state.plays=[0,1,2,3].map(player=>({player,cards:E.deck().filter(c=>c.s==='S'&&c.r!==2).slice(0,12)}));state.turn=1;document.getElementById('center').innerHTML='';render();});
  for(const size of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
   await page.setViewportSize(size);
   const geometry=await page.evaluate(()=>{
    const areas=[...document.querySelectorAll('.played')].filter(e=>e.querySelector('.card'));
    const overlap=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
    const boxes=areas.map(e=>e.getBoundingClientRect());
    return {widths:areas.map(e=>e.querySelector('.card').offsetWidth),collisions:boxes.some((a,i)=>boxes.slice(i+1).some(b=>overlap(a,b)))};
   });assert.deepEqual(geometry.widths,[88,88,88,88]);assert.equal(geometry.collisions,false,'four full-size trick lanes must not overlap');
   const ratios=await page.locator('.image-card').evaluateAll(cards=>cards.filter(c=>c.offsetWidth).map(c=>c.offsetWidth/c.offsetHeight));for(const ratio of ratios)assert.ok(Math.abs(ratio-2/3)<.015,'card boxes retain ratio');
  }
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'artifacts/card-art-offline.png'});
  await page.setContent('<style>body{margin:0;padding:24px;background:#204c37;display:grid;grid-template-columns:repeat(13,88px);gap:10px}img{width:88px;height:132px;object-fit:contain}</style>'+names.map(name=>'<img src="http://127.0.0.1:4173/assets/cards/'+name+'" alt="'+name+'">').join(''));
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await page.screenshot({path:'artifacts/deck-preview.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: 54 faces + back decoded, all source/render ratios 2:3, offline pass lock/reset and picture deck integration');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

