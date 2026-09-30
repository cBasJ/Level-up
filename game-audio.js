// Synthesized effects, user-provided recorded callouts, and Chinese TTS fallback.
(()=>{
 'use strict';
 let effects=true,speech=true,ctx,lastSelect=-Infinity;
 const voicePacks={female:window.TRACTOR_VOICE_CLIPS||{},male:window.TRACTOR_MALE_VOICE_CLIPS||{}};
 let voicePack='female',recordings=voicePacks.female;
 let recording=null,recordingQueue=[],recordingGeneration=0;
 const recordingKey=text=>text.replace(/[！!。～~\s]/g,'');
 function resetSpeech(){recordingGeneration++;recordingQueue=[];if(recording){recording.pause();recording.onended=null;recording=null;}window.speechSynthesis?.cancel();}
 function playNextRecording(){
  if(recording||!recordingQueue.length||!speech||document.hidden)return;
  const {text,file}=recordingQueue.shift(),generation=recordingGeneration;
  const audio=new Audio(file);recording=audio;audio.volume=.9;
  const complete=()=>{if(generation!==recordingGeneration)return;recording=null;playNextRecording();};
  audio.onended=complete;
  audio.play().catch(()=>{if(generation!==recordingGeneration)return;sayTTS(text);complete();});
 }
 try{const p=JSON.parse(localStorage.getItem('tractor-game-audio')||'{}');effects=p.effects!==false;speech=p.speech!==false;if(p.voicePack==='male')voicePack='male';recordings=voicePacks[voicePack];}catch{}
 const effectsButton=document.getElementById('effectsToggle'),speechButton=document.getElementById('speechToggle'),status=document.getElementById('speechStatus');
 function voices(){return window.speechSynthesis?.getVoices().filter(v=>/^zh|^cmn/i.test(v.lang))||[];}
 function update(){effectsButton.textContent='游戏音效 '+(effects?'✓':'关');effectsButton.setAttribute('aria-pressed',String(effects));speechButton.textContent='语音报牌 '+(speech?'✓':'关');speechButton.setAttribute('aria-pressed',String(speech));status.textContent=Object.keys(recordings).length?'已启用录音报牌，未收录台词使用系统中文语音。':voices().length?'中文语音已就绪':'中文报牌使用浏览器中文语音；未提供时仅播放音效。';}
 function save(){try{localStorage.setItem('tractor-game-audio',JSON.stringify({effects,speech,voicePack}));}catch{}update();}
 function unlock(){if(!effects)return;try{ctx ||= new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')void ctx.resume().catch(()=>{});}catch{}}
 document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
 function tone(frequency,time,length,volume,type='sine'){
  if(!ctx||ctx.state!=='running'||!effects||document.hidden)return;
  const o=ctx.createOscillator(),g=ctx.createGain(),at=ctx.currentTime+time;o.type=type;o.frequency.setValueAtTime(frequency,at);o.frequency.exponentialRampToValueAtTime(frequency*.65,at+length);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.006);g.gain.exponentialRampToValueAtTime(.001,at+length);o.connect(g);g.connect(ctx.destination);o.start(at);o.stop(at+length+.01);
 }
 function select(){if(performance.now()-lastSelect<65)return;lastSelect=performance.now();tone(950,0,.055,.045);}
 const number=n=>n<10?['零','一','二','三','四','五','六','七','八','九'][n]:n===10?'十':n<20?'十'+number(n%10):number(Math.floor(n/10))+'十'+(n%10?number(n%10):'');
 const rank=r=>({11:'勾',12:'圈',13:'K',14:'尖',15:'小王',16:'大王'})[r]||number(r);
 function announcement(cards,plays,state,player){
  const shape=Tractor.shape(cards,state);
  if(shape?.type==='tractor')return '拖拉机';
  if(!plays.length&&shape?.type==='throw'){
    if(cards.length>10)return '超级甩牌';
    if(cards.length===3&&Tractor.pairs(cards,state).length===1)return '边三轮';
    return cards.length>=3?'甩'+number(cards.length)+'张':'甩牌';
  }
  if(!plays.length&&shape?.cat==='T')return '调主';
  if(plays.length&&Tractor.category(plays[0].cards[0],state)==='T'&&cards.every(c=>Tractor.category(c,state)!=='T'))return '跟牌';
  if(plays.length&&Tractor.category(plays[0].cards[0],state)!=='T'&&shape?.cat==='T'&&Tractor.winner([...plays,{player,cards}],state)===player){
    const previous=plays.find(p=>p.player===Tractor.winner(plays,state));
    return Tractor.category(previous.cards[0],state)==='T'?'盖毙！':'毙了！';
  }
  if(plays.length&&Tractor.category(plays[0].cards[0],state)==='T')return Tractor.winner([...plays,{player,cards}],state)===player?'大你':'跟牌';
  if(shape?.type==='pair')return '对'+rank(cards[0].r);
  if(cards.length===1)return rank(cards[0].r);
  if(plays.length)return Tractor.winner([...plays,{player,cards}],state)===player?'大你':'跟牌';
  return '甩'+number(cards.length)+'张';
 }
 function say(text){
  if(!speech||document.hidden)return;
  const scoreFiles={'破80':'assets/voice/scores/score-80.wav','破120':'assets/voice/scores/score-120.wav','破160':'assets/voice/scores/score-160.wav'};
  const file=scoreFiles[recordingKey(text)]||recordings[recordingKey(text)];
  if(file){window.speechSynthesis?.cancel();if(recordingQueue.length>=3)recordingQueue.shift();recordingQueue.push({text,file});playNextRecording();return;}
  resetSpeech();sayTTS(text);
 }
 function sayTTS(text){
  if(!speech||document.hidden||!window.speechSynthesis)return;
  const available=voices(),voice=available.find(v=>/^zh[-_]CN$/i.test(v.lang))||available[0];if(!voice)return;
  try{
    speechSynthesis.cancel();
    // “掉” fixes the polyphonic 调 to diào; the visible/semantic announcement remains 调主.
    const spoken=text==='调主'?'掉主':text==='大你'?'大你！':text;
    const parts=spoken.includes('K')?spoken.split(/(K)/).filter(Boolean):[spoken];
    for(const part of parts){
      const english=part==='K',utterance=new SpeechSynthesisUtterance(part);
      utterance.voice=english?(speechSynthesis.getVoices().find(v=>/^en[-_]US$/i.test(v.lang))||speechSynthesis.getVoices().find(v=>/^en/i.test(v.lang))||null):voice;
      utterance.lang=english?'en-US':voice.lang;
      const emphatic=text==='大你'||text==='毙了！'||text==='盖毙！';
      utterance.rate=emphatic?1.22:1.12;utterance.pitch=emphatic?1.3:1;utterance.volume=emphatic?1:.8;
      speechSynthesis.speak(utterance);
    }
  }catch{}
 }
 function play(cards,plays,state,player){
  const text=announcement(cards,plays,state,player);
  tone(210,0,.11,.13,'triangle');tone(560,.025,.075,.05);
  if(text==='毙了！'||text==='盖毙！'){tone(440,.06,.16,.12,'triangle');tone(text==='盖毙！'?1047:784,.15,.22,.1);}
  say(text);
 }
 function bidAnnouncement(bid,previous){
  if(bid.trump==='NT')return bid.strength===4?'大王无主':'小王无主';
  if(previous&&previous.player===bid.player&&previous.strength===1&&bid.strength===2&&previous.trump===bid.trump)return '自保';
  return previous&&previous.player!==bid.player?'反主～':'亮主！';
 }
 effectsButton.onclick=()=>{effects=!effects;save();if(effects){unlock();select();}};
 const packButton=document.getElementById('voicePackToggle');
 function updatePackButton(){packButton.textContent='音源：'+(voicePack==='male'?'男声 · 男声音频':'女声 · 女生音轨');packButton.setAttribute('aria-label',packButton.textContent+'，点击切换');}
 packButton.onclick=()=>{resetSpeech();voicePack=voicePack==='female'?'male':'female';recordings=voicePacks[voicePack];save();updatePackButton();if(speech)say('亮主！');};
 speechButton.onclick=()=>{speech=!speech;save();if(!speech)resetSpeech();};
 window.speechSynthesis?.addEventListener('voiceschanged',update);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)resetSpeech();});
 window.addEventListener('pagehide',resetSpeech);
 window.GameAudio={select,play,say,score:n=>say(`破${n}`),announcement,bidAnnouncement,bid:(bid,previous)=>say(bidAnnouncement(bid,previous)),effectsEnabled:()=>effects,reset:resetSpeech,recordingStatus:()=>({voicePack,available:Object.keys(recordings).length,playing:recording?.src||null,queued:recordingQueue.length})};update();updatePackButton();
})();
