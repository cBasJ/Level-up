# 录音报牌（当前版本）

女声：用户提供的 `D:/desktop/女生音轨/女生音轨.wav`，55.867 秒。
男声：用户提供的 `D:/desktop/男声音频/男声音频.wav`，73.677 秒（尾部静音不纳入片段）。

两套均为 44.1 kHz、立体声、16-bit PCM，各 52 条；已覆盖此前版本的全部片段，新增“自保”和“超级甩牌”。原始源文件未修改。

本地语音识别核对文本，再按波形停顿确定边界；仅添加 4 毫秒边缘淡入淡出，不改变音调。`segments.json` 和 `male/segments.json` 记录源文件 SHA-256 与每条片段起止时间，`scripts/voice-cuts.json` 保存可复现的分段配置。

重建命令：

```powershell
python scripts/split-voice.py "D:/desktop/女生音轨/女生音轨.wav" female
python scripts/split-voice.py "D:/desktop/男声音频/男声音频.wav" male
```

同一玩家从单张亮主补为同花色级牌对子时说“自保”；超过十张的甩牌统一说“超级甩牌”。两套均有原录音，不再需要合成 11–25 张的报牌台词。

本文件记录用户提供录音的来源，不变更其授权条件。
