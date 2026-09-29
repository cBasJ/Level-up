// Local, original soundtrack. No external audio service or sample library.
(()=>{
 'use strict';
 let enabled=true,volume=.22,context,buffer,source,gain,loading,activated=false,offset=0,started=0;
 try{const p=JSON.parse(localStorage.getItem('tractor-music')||'{}');enabled=p.enabled!==false;if(Number.isFinite(p.volume))volume=Math.max(0,Math.min(1,p.volume));}catch{}
 const button=document.getElementById('musicToggle'),slider=document.getElementById('musicVolume'),label=document.getElementById('musicVolumeLabel');
 function update(){button.textContent='背景音乐 '+(enabled?'✓':'关');button.setAttribute('aria-pressed',String(enabled));slider.value=String(Math.round(volume*100));label.textContent=Math.round(volume*100)+'%';}
 function save(){try{localStorage.setItem('tractor-music',JSON.stringify({enabled,volume}));}catch{}update();}
 function pause(){if(source){offset=(offset+context.currentTime-started)%buffer.duration;source.stop();source.disconnect();source=null;}}
 async function play(){
  if(!enabled||!activated||document.hidden)return;
  try{
   if(!context){context=new (window.AudioContext||window.webkitAudioContext)();gain=context.createGain();gain.gain.value=volume;gain.connect(context.destination);}
   await context.resume();
   if(!buffer){loading ||= fetch('assets/music/garden-cards.wav').then(r=>{if(!r.ok)throw Error('Soundtrack unavailable');return r.arrayBuffer();}).then(data=>context.decodeAudioData(data));buffer=await loading;}
   if(!enabled||document.hidden||source)return;
   source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);started=context.currentTime;
   gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(volume,context.currentTime+.6);source.start(0,offset);
  }catch{loading=null;button.textContent='背景音乐 · 点击重试';}
 }
 function activate(){activated=true;void play();}
 document.addEventListener('pointerdown',activate);document.addEventListener('keydown',activate);
 button.addEventListener('click',()=>{enabled=!enabled;save();if(enabled){activated=true;void play();}else pause();});
 slider.addEventListener('input',()=>{volume=Number(slider.value)/100;if(gain)gain.gain.setTargetAtTime(volume,context.currentTime,.08);save();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else void play();});
 window.addEventListener('pagehide',pause);
 update();
 // Read-only diagnostics for playback verification.
 window.backgroundMusicStatus=()=>({enabled,volume,playing:!!source,duration:buffer?.duration||0,state:context?.state||'idle'});
})();
