# 畅玩升级 · 微信小游戏

微信开发者工具导入目录：`D:\projects\升级\微信小游戏`。项目类型为小游戏，已配置 AppID `wx06015b161e9671df`。

## 修改与构建

`minigame/` 是 Canvas 界面、触摸操作、微信音频和网络适配层的源码。规则复用根目录 `engine.js`，单机流程在构建时从 `backend/game.ts` 生成。原网页版继续保留。

在项目根目录执行：

```powershell
npm run build:wechat
npm run test:wechat
```

构建输出到 `微信小游戏/`，不要直接修改生成的 `game.js`。构建保留已有 AppID。音频已包含在输出目录；更换原始音轨后，使用已安装 av、numpy 的 Python 执行 `scripts/build-minigame-audio.py` 重新生成音频分包。

## 本地联机

在根目录的 PowerShell 中执行：

```powershell
$env:HOST = '0.0.0.0'
$env:ALLOW_WECHAT_ORIGIN = '1'
npm start
```

模拟器默认连接 `http://127.0.0.1:4173`。手机测试时，在游戏设置中将服务地址改为电脑的局域网 IP，例如 `http://192.168.1.20:4173`，手机与电脑需要在同一网络，并允许防火墙放行此端口。停止服务按 Ctrl+C。

当前开发工程关闭了合法域名检查。正式发布前需部署 HTTPS/WSS 服务并配置微信合法域名；后端数据库仍位于服务器 `data/tractor.sqlite`，不会打包进小游戏。现阶段使用游客账号，微信登录、正式域名、真机兼容性与发布审核需要另行完成。

## 验证范围

`test:wechat` 使用模拟 wx API 的 Canvas 客户端，覆盖单机完整一局、继续发牌、选牌、屏幕尺寸变化和四客户端真实 WebSocket 联机；它不能替代微信模拟器和真机测试。
