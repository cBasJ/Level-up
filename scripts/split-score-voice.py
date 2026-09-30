"""Split supplied score recording. Run using a Python environment with PyAV and numpy."""
import av, numpy as np, pathlib, sys, wave, json, hashlib
source=pathlib.Path(sys.argv[1]);out=pathlib.Path(__file__).resolve().parents[1]/'assets'/'voice'/'scores';out.mkdir(parents=True,exist_ok=True)
c=av.open(str(source));r=av.AudioResampler(format='s16',layout='mono',rate=24000)
frames=[x.to_ndarray().reshape(-1) for f in c.decode(audio=0) for x in r.resample(f)]
frames += [x.to_ndarray().reshape(-1) for x in r.resample(None)]
a=np.concatenate(frames);rows=[]
for score,start,end in [(80,73.18,74.13),(120,74.16,75.04),(160,75.12,76.16)]:
 clip=a[round(start*24000):round(end*24000)].copy();fade=96
 clip[:fade]=(clip[:fade]*np.linspace(0,1,fade)).astype(np.int16);clip[-fade:]=(clip[-fade:]*np.linspace(1,0,fade)).astype(np.int16)
 file=f'score-{score}.wav'
 with wave.open(str(out/file),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(24000);w.writeframes(clip.tobytes())
 rows.append(dict(score=score,text=f'破{score}',file=file,start=start,end=end))
(out/'segments.json').write_text(json.dumps(dict(source=source.name,sha256=hashlib.sha256(source.read_bytes()).hexdigest(),clips=rows),ensure_ascii=False,indent=2),encoding='utf-8')
print('Exported score 80/120/160 clips')
