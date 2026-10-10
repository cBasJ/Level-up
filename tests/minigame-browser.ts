import { chromium } from '@playwright/test';
import { createServer } from '../backend/server';
import { readFileSync,mkdtempSync,rmSync,mkdirSync } from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
async function main(){
 const dir=mkdtempSync(path.join(tmpdir(),'changwan-wx-')),server=await createServer({db:path.join(dir,'test.sqlite'),timers:false});await server.app.listen({port:0,host:'127.0.0.1'});
 const browser=await chromium.launch({channel:'chrome'}),errors:string[]=[];
 const root=path.resolve('微信小游戏');
 async function client(isolated=false){
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/wx-test',r=>r.fulfill({contentType:'text/html',body:'<html><head><style>body{margin:0;overflow:hidden}canvas{display:block}</style></head><body></body></html>'}));await page.goto(server.app.listeningOrigin+(isolated?'/wx-test':'/lobby.html'));
  await page.route('**/assets/**',async route=>{const relative=new URL(route.request().url()).pathname.slice(1),file=path.resolve(root,relative);if(file.startsWith(root+path.sep)){try{await route.fulfill({body:readFileSync(file),contentType:'image/jpeg'});return;}catch{}}await route.continue();});
  await page.evaluate(`(()=>{
   document.body.innerHTML='';window.GameGlobal=window;const handlers={},storage={};
   window.wx={getWindowInfo:()=>({windowWidth:innerWidth,windowHeight:innerHeight,pixelRatio:1}),createCanvas:()=>{const c=document.createElement('canvas');c.style.width='100vw';c.style.height='100vh';document.body.append(c);return c;},createImage:()=>new Image(),getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,onWindowResize:fn=>addEventListener('resize',fn),onTouchStart:fn=>handlers.start=fn,onTouchMove:fn=>handlers.move=fn,onTouchEnd:fn=>handlers.end=fn,onTouchCancel:()=>{},onHide:()=>{},onShow:()=>{},showToast:o=>window.lastToast=o.title,showModal:o=>o.success({confirm:true,content:o.content||''}),loadSubpackage:o=>o.success(),setClipboardData:()=>{},createInnerAudioContext:()=>({play(){},pause(){},destroy(){},onEnded(){},onError(){}}),request:o=>fetch(o.url,{method:o.method,headers:o.header,body:o.data?JSON.stringify(o.data):undefined}).then(async r=>o.success({statusCode:r.status,data:await r.json()})).catch(o.fail),connectSocket:o=>{const socket=new WebSocket(o.url);return {send:o=>socket.send(o.data),close:()=>socket.close(),onOpen:f=>socket.addEventListener('open',f),onMessage:f=>socket.addEventListener('message',f),onError:f=>socket.addEventListener('error',f),onClose:f=>socket.addEventListener('close',f)};}};
   window.touch=(type,x,y)=>handlers[type]?.({changedTouches:[{clientX:x,clientY:y}],touches:[{clientX:x,clientY:y}]});
  })()`);
  await page.addScriptTag({content:readFileSync(path.join(root,'game.js'),'utf8')});await page.evaluate(`changwanGame.base=${JSON.stringify(server.app.listeningOrigin)}`);return page;
 }
 try{
  mkdirSync('artifacts',{recursive:true});const page=await client(true);await page.waitForTimeout(300);await page.screenshot({path:'artifacts/minigame-lobby.png'});
  const voices=require('../artifacts/minigame-build/voice-map.js');
  for(const pack of ['female','male'])for(const [label,file] of Object.entries({...voices[pack],...voices.scores})){
   assert.ok(readFileSync(path.join(root,file as string)).length>100,label);
   const actual=await page.evaluate(({pack,label})=>{const a=(window as any).changwanGame.sound;a.loaded=true;a.settings.voice=pack;a.reset();a.say(label+'！');return a.current?.src;},{pack,label});assert.equal(actual,file,pack+': '+label);
  }
  await page.evaluate(`changwanGame.sound.reset();window.spoken=[];changwanGame.sound.say=t=>spoken.push(t);changwanGame.solo();clearInterval(changwanGame.session.timer);`);
  const result=await page.evaluate(`(()=>{const app=changwanGame,s=app.session,r=s.local,E=app.constructor;let steps=0;while(r.game.phase!=='over'&&steps++<1500){const g=r.game;const t=g.deadline;const original=Date.now;Date.now=()=>t+1;try{s.update();}finally{Date.now=original;}}return {phase:r.game.phase,steps,score:r.game.score,hand:r.game.hands.flat().length,publicCount:r.game.publicCards.length};})()`);
  assert.equal(result.phase,'over');assert.equal(result.hand,0);assert.equal(result.publicCount,100);assert.ok(await page.evaluate('spoken.length>25'), 'Full solo round must announce plays, not only bids');
  assert.equal(await page.evaluate('changwanGame.room.game.bottom.length'),8);
  const ending=await page.evaluate(`(()=>{const a=changwanGame,original=a.cardsRow;let shown=0;a.cardsRow=function(cards,...args){shown+=cards.length;return original.call(this,cards,...args);};a.resultAt=Date.now()-1000;a.draw();const reveal=shown;shown=0;a.resultAt=Date.now()-3000;a.draw();const result=shown;a.cardsRow=original;return {reveal,result};})()`);assert.deepEqual(ending,{reveal:8,result:0});
  await page.screenshot({path:'artifacts/minigame-result.png'});
  await page.evaluate('changwanGame.session.command("ready");');assert.equal(await page.evaluate('changwanGame.room.game.phase'),'dealing');
  // Pause/unpause local play, and test actual touch hit testing on the canvas hand.
  await page.evaluate(`(()=>{const a=changwanGame,s=a.session,g=s.local.game,deck=[...g.deck,...g.bottom];g.hands=[deck.slice(0,25),deck.slice(25,50),deck.slice(50,75),deck.slice(75,100)];g.bottom=deck.slice(100);g.hands[0].push(...g.bottom);g.phase='bury';g.turn=g.dealer=0;g.trump='S';g.plays=[];g.deadline=Date.now()+30000;s.publish();a.selected.clear();a.draw();const c=a.cards[0];touch('start',a.insetX+(c.x+5)*a.scale,a.insetY+(c.y+20)*a.scale);touch('end',a.insetX+(c.x+5)*a.scale,a.insetY+(c.y+20)*a.scale);})()`);assert.ok(await page.evaluate('changwanGame.selected.size>0'));
  assert.equal(await page.evaluate('changwanGame.room.game.hand.filter(c=>changwanGame.room.game.bottom.some(b=>b.id===c.id)).length'),8);
  assert.equal(await page.evaluate('changwanGame.cards.length'),33);
  await page.screenshot({path:'artifacts/minigame-table.png'});
  for(const viewport of [{width:844,height:390},{width:1280,height:720}]){await page.setViewportSize(viewport);await page.evaluate('changwanGame.resize();changwanGame.draw()');const bounds=await page.locator('canvas').boundingBox();assert.ok(bounds&&Math.abs(bounds.width-viewport.width)<2&&Math.abs(bounds.height-viewport.height)<2);}
  await page.setViewportSize({width:844,height:390});
  for(const left of [59,0]){
   const bounds=await page.evaluate((left)=>{const a=(window as any).changwanGame;(window as any).wx.getWindowInfo=()=>({windowWidth:844,windowHeight:390,pixelRatio:1,safeArea:{left,right:left?844:785,top:0,bottom:369}});(window as any).wx.getMenuButtonBoundingClientRect=()=>({left:730,right:830,top:8,bottom:40,width:100,height:32});a.resize();a.draw();const p=a.point({changedTouches:[{clientX:a.insetX+24*a.scale,clientY:a.insetY+100*a.scale}]});return {left:a.insetX+21*a.scale,right:a.insetX+(a.w-27)*a.scale,center:a.insetX+a.w*a.scale/2,settingsTop:a.insetY+a.hits[1].y*a.scale,point:p};},left);
   assert.ok(bounds.left>=59&&bounds.right<=785);assert.equal(bounds.center,422);assert.ok(bounds.settingsTop>=48);assert.ok(Math.abs(bounds.point.x-24)<.001&&Math.abs(bounds.point.y-100)<.001);
  }
  await page.screenshot({path:'artifacts/minigame-safe-area.png'});
  await page.evaluate('changwanGame.session.destroy();clearInterval(changwanGame.loop)');await page.close();
  const pages=await Promise.all([client(),client(),client(),client()]);
  await pages[0].evaluate(`changwanGame.connect({type:'create',data:{settings:{startLevel:6,turnSeconds:60,maxRounds:4}}})`);await pages[0].waitForFunction('changwanGame.room?.code || window.lastToast');assert.equal(await pages[0].evaluate('window.lastToast'),undefined);const code=await pages[0].evaluate('changwanGame.room.code');
  for(let i=1;i<4;i++){await pages[i].evaluate(`changwanGame.connect({type:'join',data:{code:${JSON.stringify(code)}}})`);await pages[i].waitForFunction('changwanGame.room?.code');}
  for(const p of pages)await p.waitForFunction('changwanGame.room.members.length===4');
  for(let i=0;i<4;i++){await pages[i].waitForFunction(revision=>(window as any).changwanGame.room.revision===revision,server.rooms.get(code)!.revision);await pages[i].evaluate('changwanGame.session.command("ready")');if(i<3)for(const p of pages)await p.waitForFunction((i)=>(window as any).changwanGame.room.members[i].ready,i);}await pages[0].waitForFunction('changwanGame.room.game?.phase==="dealing"');assert.equal(server.rooms.get(code)!.game!.level,6);
  for(const p of pages){assert.equal(await p.evaluate('"hands" in changwanGame.room.game'),false);await p.evaluate('changwanGame.session.destroy();clearInterval(changwanGame.loop)');}
  assert.deepEqual(errors,[]);console.log('PASS Canvas client boots without DOM dependencies; complete solo round; next deal; selection; screen fit; four real network clients with shared server and private hands. (wx APIs simulated; not a WeChat certification.)');
 }finally{await browser.close();await server.app.close();rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
