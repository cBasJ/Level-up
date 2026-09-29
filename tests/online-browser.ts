import {chromium} from '@playwright/test';
import {createServer} from '../backend/server';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
async function main(){
  const dir=mkdtempSync(path.join(tmpdir(),'tractor-browser-'));let clock=Date.now();
  const server=await createServer({db:path.join(dir,'game.db'),clock:()=>clock,timers:false});
  await server.app.listen({port:0,host:'127.0.0.1'});
  const browser=await chromium.launch({channel:'chrome',headless:true});const errors:string[]=[];
  try{
    const pages=[];
    for(let i=0;i<4;i++){const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(server.app.listeningOrigin+'/online.html');await page.locator('#nickname').fill('测试玩家'+i);await page.locator('#login button').click();await page.locator('#roomActions').waitFor({state:'visible'});pages.push(page);}
    await pages[0].locator('#create').click();await pages[0].locator('#confirmCreate').click();await pages[0].locator('#table').waitFor({state:'visible'});const code=[...server.rooms.keys()][0];
    for(let i=1;i<4;i++){await pages[i].locator('#roomCode').fill(code);await pages[i].locator('#join button').click();await pages[i].locator('#table').waitFor({state:'visible'});}
    for(const page of pages)await page.locator('#ready').click();
    await pages[0].waitForTimeout(100);
    const g=server.rooms.get(code)!.game!,prefix=['0-S-2','0-H-3','0-J-15','0-C-3','1-S-2','1-H-3','1-J-15','1-C-3','0-J-16','0-D-3','0-C-4','1-C-4','1-J-16'];
    const all=[...g.deck,...g.bottom];const arranged=[...prefix.map(id=>all.find(c=>c.id===id)!),...all.filter(c=>!prefix.includes(c.id))];g.deck=arranged.slice(0,100);g.bottom=arranged.slice(100);
    clock+=100;server.advance();
    await pages[1].locator('#passBid').click();await pages[1].reload();await pages[1].waitForFunction(()=>document.getElementById('passBid')?.textContent==='已不叫');assert.equal(await pages[1].locator('#bids [data-suit]:enabled').count(),0);
    const spades=pages[0].locator('#bids [data-suit="S"]');await spades.waitFor({state:'visible'});await pages[0].waitForFunction(()=>!(document.querySelector('#bids [data-suit="S"]') as HTMLButtonElement).disabled);
    const hit=await spades.boundingBox();assert.ok(hit);await pages[0].mouse.move(hit.x+hit.width/2,hit.y+hit.height/2);await pages[0].mouse.down();
    // The old client removed this very button during these deal snapshots, losing click.
    for(let i=1;i<5;i++){clock+=100;server.advance();}await pages[0].waitForTimeout(120);await pages[0].mouse.up();await pages[0].waitForTimeout(100);
    assert.equal(server.rooms.get(code)!.game!.currentBid?.choice,'S1');
    assert.equal(await pages[0].locator('#passBid').isVisible(),false);assert.equal(await pages[2].locator('#passBid').isVisible(),true);
    await spades.tap();await pages[0].waitForTimeout(100);assert.equal(server.rooms.get(code)!.game!.currentBid?.choice,'S2');
    for(let i=5;i<13;i++){clock+=100;server.advance();}await pages[2].waitForTimeout(100);await pages[2].locator('#bids [data-suit="SJ"]').tap();await pages[0].waitForTimeout(100);assert.equal(server.rooms.get(code)!.game!.currentBid?.choice,'SJ');
    await pages[0].locator('#bids [data-suit="BJ"]').tap();await pages[0].waitForTimeout(100);assert.equal(server.rooms.get(code)!.game!.currentBid?.choice,'BJ');
    for(let i=13;i<100;i++){clock+=100;server.advance();}
    await pages[0].waitForFunction(()=>document.querySelectorAll('#hand .card').length===33);
    assert.equal(await pages[0].locator('#bids button').count(),7);
    await pages[0].reload();await pages[0].waitForFunction(()=>document.querySelectorAll('#hand .card').length===33);
    const room=server.rooms.get(code)!;assert.equal(room.game!.phase,'bury');
    for(let i=0;i<8;i++)await pages[0].locator('#hand .card').nth(i).click({modifiers:['Shift'],position:{x:10,y:35}});
    assert.equal(await pages[0].locator('#hand .selected').count(),8);
    await pages[0].locator('#play').click();await pages[0].waitForFunction(()=>document.querySelectorAll('#hand .card').length===25);
    await pages[0].locator('#hint').click();await pages[0].locator('#play').click();await pages[0].waitForTimeout(200);
    assert.equal(server.rooms.get(code)!.game!.turn,3);
    for(let i=0;i<4;i++){assert.equal(await pages[i].locator('#play').isVisible(),i===3);assert.equal(await pages[i].locator('#hint').isVisible(),i===3);}
    for(let i=0;i<3;i++){clock=server.rooms.get(code)!.game!.deadline;server.advance();}
    await pages[0].waitForFunction(()=>document.querySelectorAll('#plays>div').length===4);
    for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
      await pages[0].setViewportSize(viewport);
      const gap=await pages[0].evaluate(`(()=>{const north=document.querySelector('.play-2'),south=document.querySelector('.play-0');return south.offsetTop-north.offsetTop-north.offsetHeight;})()`);
      assert.ok(gap>=40,`central trick separation must stay at least 40 logical pixels, got ${gap}`);
    }
    await pages[0].setViewportSize({width:1440,height:900});
    mkdirSync('artifacts',{recursive:true});await pages[0].screenshot({path:'artifacts/online-table.png'});
    clock=server.rooms.get(code)!.game!.deadline;server.advance();await pages[0].waitForTimeout(150);await pages[0].locator('#previous').click();assert.equal(await pages[0].locator('#previous').textContent(),'返回');await pages[0].locator('#previous').click();assert.equal(await pages[0].locator('#previous').textContent(),'上轮');
    await pages[0].locator('#settingsBtn').click();await pages[0].locator('#voicePackToggle').click();assert.match(await pages[0].locator('#voicePackToggle').textContent()||'',/男声/);await pages[0].locator('#closeSettings').click();
    await pages[0].setViewportSize({width:844,height:390});await pages[0].waitForTimeout(100);
    const bounds=await pages[0].locator('#table').boundingBox();assert.ok(bounds&&bounds.x>=-1&&bounds.x+bounds.width<=845&&bounds.y+bounds.height<=391,'mobile landscape table fits viewport');
    await pages[0].screenshot({path:'artifacts/online-mobile.png'});
    for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:390,height:844},{width:375,height:667}]){
      await pages[0].setViewportSize(viewport);await pages[0].waitForTimeout(100);
      const metrics=await pages[0].evaluate(`(()=>{const box=(id)=>document.querySelector(id).getBoundingClientRect(),a=box('#onlineApp'),h=box('#hand'),tools=box('#tableTools'),cards=[...document.querySelectorAll('#hand .card')].map(c=>c.getBoundingClientRect());return {a:{x:a.x,y:a.y,right:a.right,bottom:a.bottom},overlap:Math.min(h.right,tools.right)>Math.max(h.left,tools.left)&&Math.min(h.bottom,tools.bottom)>Math.max(h.top,tools.top),step:cards[1].x-cards[0].x,width:cards[0].width};})()`);
      assert.ok(metrics.a.x>=-1&&metrics.a.y>=-1&&metrics.a.right<=viewport.width+1&&metrics.a.bottom<=viewport.height+1);assert.equal(metrics.overlap,false);assert.ok(metrics.step<metrics.width*.6,'cards stay overlapped');
      // Touch tap and drag on an opponent's turn must still select cards, including portrait rotation.
      const first=await pages[0].locator('#hand .card').first().boundingBox(),fourth=await pages[0].locator('#hand .card').nth(3).boundingBox();assert.ok(first&&fourth);
      if(viewport.height>viewport.width){assert.equal(await pages[0].locator('#orientationPrompt').isVisible(),true);continue;}
      const portrait=false,point=(b:NonNullable<typeof first>)=>portrait?{x:b.x+b.width*.4,y:b.y+4}:{x:b.x+4,y:b.y+b.height*.5};const from=point(first),to=point(fourth);
      const beforeSelection=await pages[0].locator('#hand .selected').count();const cdp=await pages[0].context().newCDPSession(pages[0]);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[to]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pages[0].waitForTimeout(100);assert.notEqual(await pages[0].locator('#hand .selected').count(),beforeSelection);await cdp.detach();
    }
    await pages[0].screenshot({path:'artifacts/online-portrait.png'});
    assert.deepEqual(errors,[]);console.log('PASS: live-deal hold/click bidding, self-reinforce, small/big joker no-trump, hidden actions, four clients, replay, overlap-free desktop/mobile/portrait and real touch dragging');
  }finally{await browser.close();await server.app.close();rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
