const {chromium}=require('@playwright/test'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.spoken=[];window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};speechSynthesis.getVoices=()=>[{lang:'zh-CN',name:'Test Chinese'}];speechSynthesis.speak=u=>spoken.push(u.text);});
  await page.route('**/assets/voice/voice-clips.js',route=>route.fulfill({contentType:'application/javascript',body:'window.TRACTOR_VOICE_CLIPS = {};'}));
  await page.goto('http://127.0.0.1:4173/index.html?normal=1');
  const results=await page.evaluate(()=>{
   clearTimers();let i=0;const c=(s,r)=>({s,r,id:String(i++)}),pair=(s,r)=>[c(s,r),c(s,r)],ctx={level:2,trump:'H'},announce=(cards,plays=[])=>GameAudio.announcement(cards,plays,ctx,0);
   return [announce([c('S',14)]),announce(pair('S',14)),announce(pair('S',2)),announce([c('S',14),c('S',13),c('S',12)]),announce([c('S',9)],[{player:1,cards:[c('S',10)]}]),announce([c('S',11)],[{player:1,cards:[c('S',10)]}]),announce([...pair('S',5),...pair('S',6)],[{player:1,cards:[...pair('S',10),...pair('S',11)]}])];
  });assert.deepEqual(results,['尖','对尖','调主','甩三张','九','勾','拖拉机']);
  const extra=await page.evaluate(()=>{
   let i=100;const c=(s,r)=>({s,r,id:String(i++)}),pair=(s,r)=>[c(s,r),c(s,r)],ctx={level:2,trump:'H'},lead={player:1,cards:[c('S',14)]};
   return [GameAudio.announcement([c('H',5)],[lead],ctx,0),GameAudio.announcement([c('H',10)],[lead,{player:2,cards:[c('H',5)]}],ctx,0),GameAudio.announcement([c('H',4)],[lead,{player:2,cards:[c('H',5)]}],ctx,0),GameAudio.announcement([c('S',13)],[],ctx,0),GameAudio.announcement(pair('S',13),[],ctx,0),GameAudio.announcement(pair('S',10),[{player:1,cards:pair('S',11)}],ctx,0),GameAudio.announcement([c('H',9)],[],ctx,0)];
  });assert.deepEqual(extra,['毙了！','盖毙！','四','K','对K','对十','调主']);
  const newCalls=await page.evaluate(()=>{
   const ctx={level:2,trump:'H'},c=(s,r)=>({id:s+r,s,r});
   return [GameAudio.bidAnnouncement({player:0,trump:'S',strength:1},null),GameAudio.bidAnnouncement({player:1,trump:'H',strength:2},{player:0}),GameAudio.bidAnnouncement({player:2,trump:'NT',strength:3},{player:1}),GameAudio.bidAnnouncement({player:3,trump:'NT',strength:4},{player:2}),GameAudio.announcement([c('S',14)],[{player:1,cards:[c('H',5)]}],ctx,0),GameAudio.announcement([c('H',9)],[{player:1,cards:[c('H',5)]}],ctx,0)];
  });assert.deepEqual(newCalls,['亮主！','反主～','小王无主','大王无主','跟牌','大你']);
  const newRules=await page.evaluate(()=>{
   const ctx={level:2,trump:'H'},hand=Tractor.deck().filter(c=>c.s==='S'&&c.r!==2).slice(0,11);
   return [GameAudio.bidAnnouncement({player:0,trump:'S',strength:2},{player:0,trump:'S',strength:1}),GameAudio.bidAnnouncement({player:1,trump:'S',strength:2},{player:0,trump:'S',strength:1}),GameAudio.announcement(hand,[],ctx,0)];
  });assert.deepEqual(newRules,['自保','反主～','超级甩牌']);
  const leadCalls=await page.evaluate(()=>{let i=900;const c=(s,r)=>({id:String(i++),s,r}),p=(s,r)=>[c(s,r),c(s,r)],ctx={level:2,trump:'H'};return [GameAudio.announcement([c('H',14),c('H',13)],[],ctx,0),GameAudio.announcement([...p('H',8),...p('H',9)],[],ctx,0),GameAudio.announcement([...p('H',8),...p('H',9)],[{player:1,cards:[...p('S',8),...p('S',9)]}],ctx,0)];});assert.deepEqual(leadCalls,['甩牌','拖拉机','拖拉机']);
  const throwCalls=await page.evaluate(()=>{
   let i=500;const c=(s,r)=>({id:String(i++),s,r}),pair=(s,r)=>[c(s,r),c(s,r)],ctx={level:2,trump:'H'},a=(cards,plays=[])=>GameAudio.announcement(cards,plays,ctx,0);
   return [a([...pair('H',14),c('H',13)]),a([c('H',14),c('H',13),c('H',12)]),a([...pair('S',14),c('S',13)]),a([c('S',14),c('S',13),c('S',12),c('S',11)]),a([...pair('H',14),...pair('H',11)]),a([c('H',4)],[{player:1,cards:[c('H',9)]}]),a(pair('H',10),[{player:1,cards:pair('H',9)}]),a(pair('H',8),[{player:1,cards:pair('H',9)}]),a([...pair('H',8),...pair('H',9)],[{player:1,cards:[...pair('H',6),...pair('H',7)]}])];
  });assert.deepEqual(throwCalls,['边三轮','甩三张','边三轮','甩四张','甩四张','跟牌','大你','跟牌','拖拉机']);
  await page.locator('#settingsBtn').click();
  const speechDetails=await page.evaluate(()=>{const lines=[];const original=speechSynthesis.speak;speechSynthesis.speak=u=>lines.push({text:u.text,lang:u.lang,pitch:u.pitch,volume:u.volume});GameAudio.say('大你');GameAudio.say('调主');GameAudio.say('对K');speechSynthesis.speak=original;return lines;});
  assert.equal(speechDetails[0].text,'大你！');assert.ok(speechDetails[0].pitch>1);assert.equal(speechDetails[1].text,'掉主');assert.equal(speechDetails[3].lang,'en-US');assert.equal(speechDetails[3].text,'K');
  await page.evaluate(()=>GameAudio.say('拖拉机'));assert.deepEqual(await page.evaluate(()=>spoken),['拖拉机']);
  await page.locator('#speechToggle').click();await page.evaluate(()=>GameAudio.say('大你'));assert.deepEqual(await page.evaluate(()=>spoken),['拖拉机']);
  await page.locator('#effectsToggle').click();assert.equal(await page.evaluate(()=>GameAudio.effectsEnabled()),false);
  await page.reload();assert.equal(await page.locator('#speechToggle').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#effectsToggle').getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);console.log('Single/pair/throw/tractor and winning/losing speech, independent switches and persistence passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
