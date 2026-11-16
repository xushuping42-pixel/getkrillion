# Krillion Unlimited

本地静态演示版，按最新交付的 `main.js` / `build.mjs` 接线完成，尚未部署。

## 运行

需要当前环境的 Node.js 24，无第三方依赖。

```powershell
node tools/build.mjs
node --test
node tools/dev.mjs
```

浏览器打开 http://127.0.0.1:8788/ ，不能直接双击 HTML。修改后重新构建并刷新。Ctrl+C 结束服务。本机没有 npm/npx/python，因此使用仓库自带 Node 静态服务验证，未运行 Wrangler 或 npx serve。

`package.json` 不含 `type`。当前 Node 能识别 `.js` 内的 ES module 语法，导入时可能输出 MODULE_TYPELESS_PACKAGE_JSON 警告；这不是语法或运行错误。

## 本轮文件与兼容修复

- `js/load.js`、`js/settle.js` 保持上一轮提供的原文及导出接口。
- 最新 `main.js` 和 `build.mjs` 已写盘，并修正会阻断运行的接线错误：排期映射笔误、旧 `game.js` 参数及实例成员不匹配、题号错误、`cat` 字段显示、提示信息重绘后消失、答案页没有 `#game` 时启动报错。
- `createGame(prompts)` 提供 `prompt / rounds / total / done / tries / scores / guess(text) / next()`。保留原来的双参数调用及函数导出，便于兼容已有工具。`rounds` 固定包含七题，当前题号使用 `cur`，以保证分享卡分母为 700。
- 每题三次有效尝试；命中和未命中均消耗尝试，同一答案的重复/别名不消耗尝试或重复计分。同题取最高分，第三次后自动换题。七题完成后 `next()` 重置为练习局。
- 演示、离线、缓存和练习局不更新 best/streak。正式 live 局完成时才调用 `finish()`。当前入口不实现每日进度持久化、跨午夜自动换题、倒计时或 streak 展示；这些不能视为已完成的正式版功能。

## 演示验收

`data/prompts.demo.json` 含 9 条演示题，顶层带 `demo: true`。原有 `data/prompts.json` 同样为演示题库；两者都不是已定稿的 397 题。现有 1095 天排期是先前创建的演示排期，start 不代表正式上线日。

构建识别演示数据后，在首页设置 `window.KRIL_DEMO = true`。浏览器日志输出 `[krillion] bank mode = demo`，显示黄色 `Demo build — question bank not final` 提示，`robots.txt` 为 `Disallow: /`，sitemap 只有首页 `/`。所有演示页面含 noindex。

有排期时只生成 start 到纽约今天之间的归档，未来日期不生成。无排期或 start 为空时只生成首页，不生成答案页或归档，并清理此前生成的相关 index 文件。扩展排期工具保留全部已有日期，仅往后追加。

浏览器已跑通完整七题、每题三次尝试、重复答案处理、693/700 结算及练习重开，控制台无错误。`preview.jpg` 是本轮结算截图。`node --test` 共 9 项通过，覆盖实例 API、匹配、分数、旧格式存档序列化、streak 工具、加载降级、排期扩展、正式/演示构建和无排期分支。工具层存档测试通过不代表当前入口已接入进度恢复。

## 计分与正式上线

延续已确认公式 `max(5, 100 − rank)`，rank 从 1 开始，以答案数组顺序为准。排名 1 得 99，七题最高 693，结算/分享保留 `/700`。页面已修正“100 分首位”“700 可达满分”的矛盾文案。

正式上线仍需已定稿的 397 题、PPT 对照和真实上线日。用正式题库替换 `data/prompts.json`，移出并备份旧演示排期，再执行：

```powershell
node tools/schedule.mjs --start YYYY-MM-DD --days 1095
node tools/build.mjs
node --test
```

正式题库顶层不可带 demo 标记。首次排期后只用相同 start 和更大的 --days 扩展；不得重写历史题目、答案或 ID。构建会检查七个有效且不同的 ID。正式数据就绪后还需重新进行浏览器验收。

首页和答案页由构建生成，不手写产物。答案页为静态页面，正式发布后必须在纽约每天午夜后重新构建部署，否则会保留上次构建时的内容。当前没有配置 CI、定时部署或 Cloudflare 凭据。发布只上传 HTML、css、js、data、_headers、sitemap 和 robots，不上传工具、测试和截图。
