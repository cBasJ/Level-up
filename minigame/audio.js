const P=require('./platform');
const voice=require('./voice-map');
class Sound{
 constructor(settings){this.settings=settings;this.queue=[];this.loaded=false;this.generation=0;}
 unlock(){if(this.loaded){this.music();return;}if(this.loading)return;this.loading=true;wx.loadSubpackage({name:'sound',success:()=>{this.loaded=true;this.loading=false;this.music();},fail:()=>{this.loading=false;}});}
 music(){if(!this.loaded)return;if(!this.bgm){this.bgm=wx.createInnerAudioContext();this.bgm.src='sound/music.mp3';this.bgm.loop=true;}this.bgm.volume=this.settings.volume||.22;if(this.settings.music)this.bgm.play();else this.bgm.pause();}
 effect(name){if(!this.loaded||!this.settings.effects)return;const a=wx.createInnerAudioContext();a.src='sound/'+name+'.wav';const stop=()=>a.destroy();a.onEnded(stop);a.onError(stop);a.play();}
 say(text){if(!this.loaded||!this.settings.speech)return;const key=text.replace(/[！!。～~\s]/g,''),file=voice[this.settings.voice||'female'][key]||voice.scores[key];if(!file)return;if(this.queue.length>4)this.queue.shift();this.queue.push(file);this.next();}
 next(){if(this.current||!this.queue.length)return;const a=this.current=wx.createInnerAudioContext();a.src=this.queue.shift();a.volume=.9;const done=()=>{if(this.current!==a)return;a.destroy();this.current=null;this.next();};a.onEnded(done);a.onError(done);a.play();}
 reset(){this.queue=[];if(this.current){this.current.destroy();this.current=null;}this.bgm?.pause();}
}
module.exports=Sound;
