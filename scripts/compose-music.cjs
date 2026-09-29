// Original score and sample-free additive synthesis for this project.
// Run: node scripts/compose-music.cjs
const fs=require('node:fs'),path=require('node:path');
const rate=22050,bpm=92,beat=60/bpm,bars=24,duration=bars*4*beat,size=Math.round(duration*rate);
const left=new Float64Array(size),right=new Float64Array(size);
let seed=70219;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const hz=m=>440*2**((m-69)/12);
function note(m,start,length,volume,pan,voice='wood'){
 const f=hz(m),n=Math.ceil((length+.45)*rate),base=Math.round(start*rate);
 for(let i=0;i<n;i++){
  const t=i/rate,release=Math.min(1,Math.max(0,(length+.45-t)/.45));let v;
  if(voice==='wood')v=(Math.sin(2*Math.PI*f*t)*Math.exp(-3.3*t)+.24*Math.sin(2*Math.PI*f*3.98*t)*Math.exp(-9*t)+.065*Math.sin(2*Math.PI*f*10.65*t)*Math.exp(-17*t))*Math.min(1,t/.005);
  else if(voice==='string')v=(Math.sin(2*Math.PI*f*t)+.24*Math.sin(2*Math.PI*f*2*t)+.075*Math.sin(2*Math.PI*f*3*t))*Math.exp(-3*t)*Math.min(1,t/.012);
  else if(voice==='flute')v=(Math.sin(2*Math.PI*f*t+.018*Math.sin(2*Math.PI*4.8*t))+.08*Math.sin(2*Math.PI*f*2*t))*Math.min(1,t/.11)*Math.exp(-.65*t);
  else v=(Math.sin(2*Math.PI*f*t)+.12*Math.sin(2*Math.PI*f*2*t))*Math.min(1,t/.02)*Math.exp(-2*t);
  v*=volume*release;const k=(base+i)%size;left[k]+=v*Math.sqrt((1-pan)/2);right[k]+=v*Math.sqrt((1+pan)/2);
 }
}
// D-major pentatonic melody, with a contrasting middle phrase.
// Each row is one bar; entries are [beat offset, MIDI pitch, beat length].
const melody=[
 [[.5,74,.5],[1.25,78,.75],[2.5,76,.5],[3.25,81,.65]],
 [[0,78,1],[1.5,76,.5],[2.25,74,.75]],
 [[.25,71,.75],[1.5,74,.5],[2.5,78,.5],[3.25,76,.5]],
 [[0,73,.75],[1.25,76,.5],[2.25,69,1.2]],
 [[.5,74,.5],[1.25,78,.5],[2,81,.75],[3.25,83,.5]],
 [[0,81,.75],[1.25,78,.75],[2.5,76,1]],
 [[.25,78,.5],[1,76,.5],[2,74,.75],[3.25,71,.5]],
 [[0,73,.75],[1.25,76,.5],[2.5,74,1.25]],
 [[0,83,.75],[1.5,81,.5],[2.25,78,.75]],
 [[.5,79,.5],[1.25,78,.5],[2,76,1.2]],
 [[0,78,.5],[.75,81,.5],[1.75,83,.75],[3,81,.75]],
 [[.25,76,.75],[1.5,73,.5],[2.5,69,1]],
 [[0,74,.75],[1,78,.5],[2.25,76,.5],[3,74,.75]],
 [[.5,71,.75],[1.75,74,.5],[2.75,78,.75]],
 [[0,76,.5],[1,78,.5],[2,81,.75],[3.25,76,.5]],
 [[0,73,1],[1.5,76,.5],[2.5,81,1]],
 [[.25,78,.75],[1.25,74,.5],[2.5,76,.5],[3.25,81,.5]],
 [[0,83,.75],[1.25,81,.5],[2.25,78,1]],
 [[.5,76,.5],[1.25,74,.75],[2.75,71,.75]],
 [[0,73,.75],[1.5,76,.5],[2.5,78,.75]],
 [[.25,81,.5],[1,78,.75],[2.25,76,.5],[3,74,.75]],
 [[0,71,.75],[1.25,74,.5],[2.25,78,.75]],
 [[.25,76,.75],[1.5,73,.5],[2.5,69,.75]],
 [[0,74,1.4],[2,78,.65],[3.25,76,.5]]
];
const chords=[[50,57,62,66],[47,54,59,62],[43,50,55,59],[45,52,57,61],[50,57,62,66],[47,54,59,62],[43,50,55,59],[45,52,57,61]];
for(let bar=0;bar<bars;bar++){
 const chord=chords[bar%8],base=bar*4*beat;
 for(const [at,pitch,len] of melody[bar]){
  note(pitch,base+at*beat,len*beat,.23,.13,'wood');
  if(bar>=8&&bar<16)note(pitch-12,base+at*beat,len*beat,.045,-.22,'flute');
 }
 [0,1.5,2.5,3.5].forEach((at,i)=>note(chord[[1,2,3,2][i]]+12,base+at*beat,.42,.065,-.48,'string'));
 note(chord[0],base,1.6*beat,.16,-.06,'bass');note(chord[0]+7,base+2*beat,1.3*beat,.11,.06,'bass');
 // Quiet synthetic brushed shaker: differentiated deterministic noise, no samples.
 for(let b=.5;b<4;b+=.5){let previous=0;const start=Math.round((base+b*beat)*rate);
  for(let i=0;i<rate*.065;i++){const value=random()*2-1,t=i/rate,v=(value-previous)*Math.exp(-65*t)*Math.min(1,t/.003)*.009;previous=value;const k=(start+i)%size;left[k]+=v*.6;right[k]+=v;}
 }
}
// Circular reflections retain the reverb tail across the loop boundary.
const dryL=left.slice(),dryR=right.slice();
for(const [delay,gain] of [[.117,.10],[.233,.075],[.379,.055],[.523,.035]]){
 const offset=Math.round(delay*rate);for(let i=0;i<size;i++){const j=(i+offset)%size;left[j]+=dryR[i]*gain;right[j]+=dryL[i]*gain;}
}
let peak=0,sum=0;for(let i=0;i<size;i++){peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));sum+=left[i]**2+right[i]**2;}
const scale=.72/peak,buffer=Buffer.alloc(44+size*4);
buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(2,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*4,28);buffer.writeUInt16LE(4,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(size*4,40);
for(let i=0;i<size;i++){buffer.writeInt16LE(Math.round(left[i]*scale*32767),44+i*4);buffer.writeInt16LE(Math.round(right[i]*scale*32767),46+i*4);}
const output=path.join(__dirname,'../assets/music/garden-cards.wav');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,buffer);
console.log(JSON.stringify({output,seconds:size/rate,bpm,peak:.72,rms:Math.sqrt(sum/(size*2))*scale,bytes:buffer.length}));
