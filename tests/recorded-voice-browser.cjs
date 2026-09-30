const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('assets/voice/segments.json','utf8'));assert.equal(manifest.clips.length,52);
 for(const clip of manifest.clips){const bytes=fs.readFileSync('assets/voice/'+clip.file);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.ok(clip.duration>.25&&clip.duration<1.3);assert.ok(Math.abs((bytes.length-44)/bytes.readUInt32LE(28)-clip.duration)<.002);}
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/index.html?normal=1');await page.evaluate(()=>clearTimers());await page.locator('#settingsBtn').click();
  assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().available),52);assert.match(await page.locator('#speechStatus').textContent(),/录音报牌/);
  const decoded=await page.evaluate(async()=>{const ctx=new AudioContext();let count=0;for(const url of Object.values(TRACTOR_VOICE_CLIPS)){const r=await fetch(url);if(!r.ok)throw Error(url);const audio=await ctx.decodeAudioData(await r.arrayBuffer());if(audio.duration>.25)count++;}await ctx.close();return count;});assert.equal(decoded,52);
  await page.evaluate(()=>{GameAudio.reset();GameAudio.say('亮主！');GameAudio.say('反主～');});
  assert.match(await page.evaluate(()=>GameAudio.recordingStatus().playing),/bid\.wav$/);assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().queued),1);
  await page.waitForFunction(()=>GameAudio.recordingStatus().playing?.endsWith('counter.wav'));
  await page.locator('#speechToggle').click();assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().playing),null);assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().queued),0);
  await page.locator('#speechToggle').click();await page.evaluate(()=>GameAudio.say('对K'));assert.match(await page.evaluate(()=>GameAudio.recordingStatus().playing),/pair-13\.wav$/);
  await page.evaluate(()=>GameAudio.reset());assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().playing),null);
  await page.locator('#voicePackToggle').click();assert.match(await page.evaluate(()=>GameAudio.recordingStatus().playing),/male\/bid\.wav$/);assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().voicePack),'male');
  const maleDecoded=await page.evaluate(async()=>{const ctx=new AudioContext();let count=0;for(const url of Object.values(TRACTOR_MALE_VOICE_CLIPS)){const r=await fetch(url);if(!r.ok)throw Error(url);const audio=await ctx.decodeAudioData(await r.arrayBuffer());if(audio.duration>.25)count++;}await ctx.close();return count;});assert.equal(maleDecoded,52);
  await page.evaluate(()=>{GameAudio.reset();GameAudio.say('对K');GameAudio.say('拖拉机');});assert.match(await page.evaluate(()=>GameAudio.recordingStatus().playing),/male\/pair-13\.wav$/);
  await page.locator('#voicePackToggle').click();assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().voicePack),'female');assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().queued),0);assert.match(await page.evaluate(()=>GameAudio.recordingStatus().playing),/voice\/bid\.wav$/);
  await page.locator('#voicePackToggle').click();await page.reload();await page.evaluate(()=>clearTimers());await page.locator('#settingsBtn').click();assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().voicePack),'male');
  await page.locator('#speechToggle').click();await page.locator('#voicePackToggle').click();assert.equal(await page.evaluate(()=>GameAudio.recordingStatus().playing),null);await page.locator('#speechToggle').click();
  const fallback=await page.evaluate(()=>{window.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};speechSynthesis.getVoices=()=>[{lang:'zh-CN'}];let said='';speechSynthesis.speak=u=>said=u.text;GameAudio.say('甩十一张');return said;});assert.equal(fallback,'甩十一张');
  for(const n of [80,120,160]){
   await page.evaluate(n=>{GameAudio.reset();GameAudio.score(n);},n);
   assert.ok((await page.evaluate(()=>GameAudio.recordingStatus().playing)).endsWith(`scores/score-${n}.wav`));
   const duration=await page.evaluate(async n=>{const ctx=new AudioContext(),r=await fetch(`assets/voice/scores/score-${n}.wav`),a=await ctx.decodeAudioData(await r.arrayBuffer());await ctx.close();return a.duration;},n);assert.ok(duration>.7&&duration<1.3);
  }
  assert.deepEqual(errors,[]);console.log('52 recorded clips decode; matching, playback queue, mute/reset, and missing-line fallback passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
