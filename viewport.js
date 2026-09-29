(()=>{
 const prompt=document.createElement('dialog');prompt.id='orientationPrompt';prompt.innerHTML='<span class="rotate-phone" aria-hidden="true">▯ ↻ ▭</span><h2>横屏玩，牌面更清楚</h2><p>建议将手机或平板转为横屏。<br>横屏后将自动返回当前页面。</p><button type="button">尝试全屏</button><small role="status"></small>';document.body.append(prompt);
 async function fullscreen(){try{if(!document.fullscreenElement){if(!document.documentElement.requestFullscreen)throw Error();await document.documentElement.requestFullscreen();}else await document.exitFullscreen();}catch{prompt.querySelector('small').textContent='当前浏览器不支持全屏，可横屏使用或添加到主屏幕。';}}
 prompt.querySelector('button').onclick=fullscreen;
 const header=document.querySelector('.lobby-header,.table-header,header');if(header){const button=document.createElement('button');button.className='viewport-fullscreen';button.textContent='⛶';button.title='切换全屏';button.setAttribute('aria-label','切换全屏');button.onclick=fullscreen;header.append(button);}
 function update(){
  const mobile=matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const portrait=innerHeight>innerWidth;
  if(mobile&&portrait){if(!prompt.open)prompt.showModal();}else if(prompt.open)prompt.close();
  const shell=document.querySelector('.lobby-shell,.friends-shell');if(shell&&!portrait){const v=visualViewport,w=v?.width||innerWidth,h=v?.height||innerHeight,width=Math.max(1440,840*w/h),height=width*h/w;Object.assign(shell.style,{position:'fixed',width:width+'px',height:height+'px',minHeight:'0',maxWidth:'none',left:'0',top:'0',transformOrigin:'top left',transform:`scale(${w/width})`,overflow:'hidden'});}else if(shell)shell.removeAttribute('style');
 }
 prompt.addEventListener('cancel',e=>e.preventDefault());addEventListener('resize',update);addEventListener('orientationchange',update);visualViewport?.addEventListener('resize',update);document.addEventListener('fullscreenchange',update);update();
})();
