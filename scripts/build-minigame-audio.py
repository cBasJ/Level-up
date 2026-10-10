"""Compress existing recordings for WeChat's audio subpackage (PyAV + numpy)."""
from pathlib import Path
import av, math, wave, array, json
root=Path(__file__).resolve().parents[1]
out=root/'微信小游戏'/'sound'
def convert(src,dst):
    dst.parent.mkdir(parents=True,exist_ok=True)
    with av.open(str(src)) as source, av.open(str(dst),'w') as target:
        stream=target.add_stream('libmp3lame',rate=24000);stream.layout='mono';stream.bit_rate=64000
        resampler=av.AudioResampler(format='fltp',layout='mono',rate=24000)
        for frame in source.decode(audio=0):
            for f in resampler.resample(frame):
                for packet in stream.encode(f):target.mux(packet)
        for f in resampler.resample(None):
            for packet in stream.encode(f):target.mux(packet)
        for packet in stream.encode(None):target.mux(packet)
for kind,folder in [('female',root/'assets/voice'),('male',root/'assets/voice/male')]:
    for src in folder.glob('*.wav'):convert(src,out/kind/(src.stem+'.mp3'))
for src in (root/'assets/voice/scores').glob('*.wav'):convert(src,out/(src.stem+'.mp3'))
convert(root/'assets/music/garden-cards.wav',out/'music.mp3')
for name,freq,duration in [('select',950,.055),('play',210,.13)]:
    samples=array.array('h',(int(5500*math.sin(2*math.pi*freq*i/24000)*(1-i/(24000*duration))) for i in range(int(24000*duration))))
    with wave.open(str(out/(name+'.wav')),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(samples.tobytes())
folder=root/'微信小游戏'
main=sum(p.stat().st_size for p in folder.rglob('*') if p.is_file() and 'sound' not in p.relative_to(folder).parts)
audio=sum(p.stat().st_size for p in out.rglob('*') if p.is_file())
assert main<4*1024*1024, f'Main package too large: {main}'
assert audio<4*1024*1024, f'Audio package too large: {audio}'
(folder/'build-report.json').write_text(json.dumps(dict(mainBytes=main,audioBytes=audio),indent=2),encoding='utf-8')
print(f'主包 {main/1024/1024:.2f} MB; 音频分包 {audio/1024/1024:.2f} MB')
