import {chromium} from '@playwright/test';
import {createServer} from '../backend/server';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
async function main(){
  const dir=mkdtempSync(path.join(tmpdir(),'tractor-portal-'));const server=await createServer({db:path.join(dir,'game.db'),timers:false});await server.app.listen({port:0,host:'127.0.0.1'});
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    assert.equal((await server.app.inject({url:'/api/profile'})).statusCode,401);
    await page.goto(server.app.listeningOrigin+'/');assert.equal(await page.locator('#createRoom').count(),1);
    mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/lobby-desktop.png'});
    await page.getByRole('link',{name:'个人资料',exact:true}).click();await page.locator('#editName').fill('草地牌友');await page.locator('#editBio').fill('有好牌，更要有好队友');await page.locator('[data-avatar="2"]').click();await page.locator('#saveProfile').click();await page.waitForFunction(()=>document.getElementById('portalToast')?.textContent==='资料已保存');
    await page.reload();await page.waitForFunction(()=>document.getElementById('profileName')?.textContent==='草地牌友');assert.equal(await page.locator('#editBio').inputValue(),'有好牌，更要有好队友');assert.equal(await page.locator('[data-avatar="2"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#gamesPlayed').textContent(),'0');
    const identity=await page.evaluate(()=>JSON.parse(localStorage.getItem('tractor-online-user')!));
    const unrelated=server.store.createUser('另一位玩家');assert.notEqual(unrelated.id,identity.id);
    // A completed server result contributes only to its participants' statistics.
    server.store.db.prepare('INSERT INTO results VALUES(?,?,?,?)').run('test-game','123456',Date.now(),JSON.stringify({members:[{id:identity.id},{id:'b'},{id:'c'},{id:'d'}],game:{dealer:0,score:40,level:2,trump:'S'}}));
    await page.reload();await page.waitForFunction(()=>document.getElementById('gamesPlayed')?.textContent==='1');assert.equal(await page.locator('#gamesWon').textContent(),'1');assert.equal(await page.locator('#winRate').textContent(),'100%');
    const other=(await server.app.inject({url:'/api/profile',headers:{authorization:'Bearer '+unrelated.token}})).json();assert.equal(other.stats.games,0);assert.equal(other.history.length,0);
    await page.screenshot({path:'artifacts/profile-desktop.png'});
    for(const size of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`artifacts/profile-${size.width}.png`});await page.goto(server.app.listeningOrigin+'/lobby.html');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`artifacts/lobby-${size.width}.png`});await page.goto(server.app.listeningOrigin+'/profile.html');}
    await page.goto(server.app.listeningOrigin+'/lobby.html');await page.locator('#createRoom').click();await page.locator('#startLevel').selectOption('6');await page.locator('input[name=seconds][value="60"]').check();await page.locator('input[name=rounds][value="4"]').check();await page.screenshot({path:'artifacts/friends-settings.png'});await page.locator('#confirmCreate').click();await page.locator('#table').waitFor({state:'visible'});assert.equal(server.rooms.size,1);assert.deepEqual([...server.rooms.values()][0].settings,{startLevel:6,turnSeconds:60,maxRounds:4});assert.deepEqual([...server.rooms.values()][0].levels,[6,6]);assert.equal([...server.rooms.values()][0].members[0].name,'草地牌友');assert.equal([...server.rooms.values()][0].members[0].avatar,2);
    await page.goto(server.app.listeningOrigin+'/index.html?normal=1');await page.waitForFunction(()=>typeof (window as any).TableLayout==='object');assert.equal(await page.locator('#player0 .avatar-2').count(),1);await page.evaluate('clearTimers()');
    await page.evaluate(`(()=>{clearTimers();document.getElementById('center').innerHTML='';notice('等待西山出牌');state.phase='playing';state.trump='H';state.level=2;state.turn=1;state.hands=[[{id:'a',s:'S',r:10},{id:'b',s:'S',r:9},{id:'c',s:'S',r:8},{id:'d',s:'D',r:14}],[],[],[]];state.plays=[{player:2,cards:[{id:'x',s:'D',r:14}]}];state.voids=[['S'],[],['S','C'],[]];selected.clear();render();})()`);
    assert.equal(await page.locator('#player0 .void-suits').count(),0);assert.equal(await page.locator('#player2 .void-suits').count(),1);
    assert.equal(await page.locator('#play').isVisible(),false);assert.equal(await page.locator('#hint').isVisible(),false);
    await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'artifacts/offline-layout.png'});
    const avatar=await page.locator('#player2').boundingBox(),play=await page.locator('#play2').boundingBox();assert.ok(avatar&&play&&play.y>avatar.y+avatar.height,'north cards are below player details');
    for(const size of [{width:844,height:390},{width:390,height:844}]){await page.setViewportSize(size);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const bounds=await page.locator('#game').boundingBox();assert.ok(bounds&&bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=size.width+1&&bounds.y+bounds.height<=size.height+1);}
    assert.deepEqual(errors,[]);console.log('PASS: lobby, profile create/save/reload, authentic private statistics, avatar room sync, responsive pages and shared offline layout');
  }finally{await browser.close();await server.app.close();rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
