const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const wav=fs.readFileSync('assets/music/garden-cards.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),2);
 let peak=0,energy=0;for(let i=44;i<wav.length;i+=2){const v=wav.readInt16LE(i);peak=Math.max(peak,Math.abs(v));energy+=v*v;}
 assert.ok(peak<32767&&energy>0);for(let ch=0;ch<2;ch++)assert.ok(Math.abs(wav.readInt16LE(44+ch*2)-wav.readInt16LE(wav.length-4+ch*2))<2500,'loop boundary is continuous');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/index.html');
  assert.equal(await page.evaluate(()=>backgroundMusicStatus().playing),false);
  await page.locator('#settingsBtn').click();await page.waitForFunction(()=>backgroundMusicStatus().playing&&backgroundMusicStatus().duration>62);
  assert.equal(await page.evaluate(()=>backgroundMusicStatus().state),'running');
  await page.locator('#musicVolume').fill('35');assert.equal(await page.evaluate(()=>backgroundMusicStatus().volume),.35);
  await page.screenshot({path:'artifacts/music-settings.png',fullPage:true});await page.locator('#musicToggle').click();assert.equal(await page.evaluate(()=>backgroundMusicStatus().playing),false);
  await page.reload();await page.locator('#settingsBtn').click();assert.equal(await page.evaluate(()=>backgroundMusicStatus().enabled),false);assert.equal(await page.locator('#musicVolume').inputValue(),'35');
  await page.locator('#musicToggle').click();await page.waitForFunction(()=>backgroundMusicStatus().playing);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.evaluate(()=>backgroundMusicStatus().playing),false);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>backgroundMusicStatus().playing);
  assert.deepEqual(errors,[]);console.log('Original WAV waveform/loop and browser decode, playback, mute, volume, persistence, background pause passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
