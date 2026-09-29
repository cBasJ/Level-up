"""Split current voice recordings. Usage: python scripts/split-voice.py source.wav [female|male]"""
import array, hashlib, json, pathlib, sys, wave
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[1]);kind=sys.argv[2] if len(sys.argv)>2 else 'female'
entries=json.loads((root/'scripts/voice-cuts.json').read_text(encoding='utf-8'))[kind]
output=root/'assets'/'voice'
if kind=='male':output=output/'male'
output.mkdir(parents=True,exist_ok=True)
with wave.open(str(source),'rb') as reader:
    params=reader.getparams()
    if params.sampwidth!=2:raise ValueError('Expected PCM16 source')
    data=array.array('h',reader.readframes(params.nframes))
manifest={};rows=[]
for row in entries:
    start=max(0,row['start']-.055);end=min(params.nframes/params.framerate,row['end']+.075)
    clip=data[round(start*params.framerate)*params.nchannels:round(end*params.framerate)*params.nchannels]
    frames=len(clip)//params.nchannels;fade=round(.004*params.framerate)
    for i in range(fade):
        for channel in range(params.nchannels):
            head=i*params.nchannels+channel;tail=(frames-1-i)*params.nchannels+channel
            clip[head]=round(clip[head]*i/fade);clip[tail]=round(clip[tail]*i/fade)
    with wave.open(str(output/row['file']),'wb') as writer:writer.setparams(params);writer.writeframes(clip.tobytes())
    manifest[row['text']]='assets/voice/'+('male/' if kind=='male' else '')+row['file']
    rows.append(dict(text=row['text'],file=row['file'],start=round(start,3),end=round(end,3),duration=round(frames/params.framerate,3)))
(output/'voice-clips.js').write_text(('window.TRACTOR_MALE_VOICE_CLIPS' if kind=='male' else 'window.TRACTOR_VOICE_CLIPS')+' = '+json.dumps(manifest,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
(output/'segments.json').write_text(json.dumps(dict(source=source.name,sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceDuration=params.nframes/params.framerate,sampleRate=params.framerate,channels=params.nchannels,clips=rows),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Exported {kind}: {len(rows)} clips; source unchanged.')
