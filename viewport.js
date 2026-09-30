(()=>{
 const prompt=document.createElement('dialog');prompt.id='orientationPrompt';prompt.innerHTML='<span class="rotate-phone" aria-hidden="true">▯ ↻ ▭</span><h2>横屏玩，牌面更清楚</h2><p>建议将手机或平板转为横屏。<br>横屏后将自动返回当前页面。</p><button type="button">尝试全屏</button><small role="status"></small>';document.body.append(prompt);
 async function fullscreen(){try{if(!document.fullscreenElement){if(!document.documentElement.requestFullscreen)throw Error();await document.documentElement.requestFullscreen();}else await document.exitFullscreen();}catch{prompt.querySelector('small').textContent='当前浏览器不支持全屏，可横屏使用或添加到主屏幕。';}}
 prompt.querySelector('button').onclick=fullscreen;
 const header=document.querySelector('.lobby-header,.table-header,header');if(header&&!document.getElementById('fullscreen')){const button=document.createElement('button');button.className='viewport-fullscreen';button.textContent='⛶';button.title='切换全屏';button.setAttribute('aria-label','切换全屏');button.onclick=fullscreen;header.append(button);}
 function update(){
  const mobile=matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const portrait=innerHeight>innerWidth;
  if(mobile&&portrait){if(!prompt.open)prompt.showModal();}else if(prompt.open)prompt.close();
  const shell=document.querySelector('.lobby-shell,.friends-shell,.profile-shell');if(shell&&!portrait){const v=visualViewport,w=v?.width||innerWidth,h=v?.height||innerHeight,width=Math.max(1440,840*w/h),height=width*h/w;Object.assign(shell.style,{position:'fixed',width:width+'px',height:height+'px',minHeight:'0',maxWidth:'none',left:'0',top:'0',transformOrigin:'top left',transform:`scale(${w/width})`,overflow:'hidden'});}else if(shell)shell.removeAttribute('style');
 }
 prompt.addEventListener('cancel',e=>e.preventDefault());addEventListener('resize',update);addEventListener('orientationchange',update);visualViewport?.addEventListener('resize',update);document.addEventListener('fullscreenchange',update);update();
})();
/* Shared on-demand match history; identity stays in the browser, data comes from the server. */
(()=>{
 const buttons=document.querySelectorAll('[data-records]');if(!buttons.length)return;
 const modal=document.createElement('dialog');modal.id='recordsDialog';modal.setAttribute('aria-labelledby','recordsTitle');modal.innerHTML='<button type="button" class="close" aria-label="关闭战绩">×</button><h2 id="recordsTitle">对局战绩</h2><div class="records-content" aria-live="polite"></div>';document.body.append(modal);modal.querySelector('.close').onclick=()=>modal.close();
 let request=0;
 buttons.forEach(button=>button.onclick=async()=>{
  const id=++request,body=modal.querySelector('.records-content');body.textContent='正在加载战绩…';modal.showModal();
  try{
   const identity=JSON.parse(localStorage.getItem('tractor-online-user')||'null');if(!identity){body.textContent='暂无战绩。创建玩家资料并完成联网对局后会显示在这里。';return;}
   const response=await fetch('/api/profile',{headers:{Authorization:'Bearer '+identity.token}});if(!response.ok)throw Error();const profile=await response.json();if(request!==id)return;body.replaceChildren();
   const summary=document.createElement('p');summary.className='records-summary';summary.textContent=`完成 ${profile.stats.games} 局 · 获胜 ${profile.stats.wins} 局 · 胜率 ${profile.stats.games?Math.round(profile.stats.wins/profile.stats.games*100)+'%':'—'}`;body.append(summary);
   if(!profile.history.length){const empty=document.createElement('p');empty.className='empty-record';empty.textContent='还没有完成的联网牌局';body.append(empty);}
   for(const game of profile.history){const row=document.createElement('div');row.className='record-row';const result=document.createElement('b');result.textContent=game.won?'获胜':'失败';const info=document.createElement('span');info.textContent='打 '+({11:'J',12:'Q',13:'K',14:'A'}[game.level]||game.level)+' · '+({S:'黑桃',H:'红桃',C:'梅花',D:'方片',NT:'无主'}[game.trump]||'无主');const date=document.createElement('small');date.textContent=new Date(Number(game.date)).toLocaleString('zh-CN');info.append(date);const score=document.createElement('span');score.textContent='闲家 '+game.score+' 分';row.append(result,info,score);body.append(row);}
  }catch{if(request===id)body.textContent='战绩加载失败，请关闭后重试。';}
 });
})();
