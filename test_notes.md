# 可复现验证说明

## 运行

需要 Node.js 22+、Microsoft Edge 或 Chromium/Chrome，无 npm 依赖。Windows 常用浏览器路径会自动发现；其他路径设置 `EDGE_PATH` 或 `CHROME_PATH`。在项目根目录运行：

```powershell
node tests/verify.cjs
```

此命令执行静态检查、逻辑回归、六武器矩阵、12 局流程、8 视口、坐标触控、60 秒音效压力测试和真实 RAF 冒烟测试。退出码 0 表示所有已执行断言通过；任何失败或浏览器异常返回 1。通常需要约 1–2 分钟。

像素版另检查 20 个二进制素材的 SHA-256、6 张图片与 12 个采样音效解码、中文像素字体、最近邻画布、渲染不消耗玩法随机数，以及 BGM 暂停/装备抽屉/静音和声音节点回收。游戏与测试均通过 HTTP 加载本地素材。

声音回归覆盖六武器基础/进化形态的真实攻击、独立音色与并发播放、齐射单次发声、未装备时静音、混合攻击节点预算与回收，以及 BGM 音量上限 4%。

运行 `node tests/verify.cjs --preview`（或 `npm run test:preview`）可生成 4 种视口 × 开始/战斗/Boss/升级/装备共 20 张展示截图，并检查按钮尺寸和坐标命中。截图使用固定布景，仅用于视觉检查，不替代游戏流程测试。

完整交付验证和报告生成：

```powershell
node tests/verify.cjs --growth
node tests/integrity.cjs
node tests/build-report.cjs
```

`--growth` 额外运行 360 局，需数分钟。逐条检查退出码；报告生成器只接受通过且源码哈希匹配的完整运行。也可使用 package.json 对应的 `npm test`、`npm run test:growth`、`npm run test:integrity`、`npm run test:report`。

## 参数与隔离

- `PROJECT_ROOT`：待测项目根目录；默认当前脚本的父目录。
- `OUTPUT_DIR`：结果目录；默认项目内 `test-results/`，已被 Git 忽略。
- `EDGE_PATH` / `CHROME_PATH`：浏览器完整路径。
- 每次运行使用独立浏览器 profile、随机调试端口、本地 HTTP 服务，无外部账户/网络依赖。运行结束关闭本次启动的浏览器。
- `--smoke` 仅用于快速静态/核心回归，不替代完整验收。
- `VERIFY_FAULT` 是测试驱动的故障注入开关；日常验证不要设置。`integrity.cjs` 会在系统临时目录创建隔离副本，测试正常对照、异步异常、用例抛错、坏 JSON 和缺失资源，不改动生产文件。
- 校验数据记录运行 ID、父 Git 提交、实际工作区源码 SHA-256、浏览器 UA、Node 版本。提交前运行的父提交不能单独代表被测代码，应结合源码哈希。

## 产物

`test-results/` 中包含 `verification_report.json`（真实断言计数及错误）、`regressions.json`、`focused.json`、`logic.json`、`extra.json`、`dps.json`、`flows.json`、`growth.json`、`layouts.json`、`integrity.json` 和截图。

`build-report.cjs` 从这些数据生成当前版本的 `CURRENT_BENCHMARK.json`、`FIX_VERIFICATION.md`、`BALANCE_REVIEW.md`。原始随机样本和全部成长轨迹保存在本地结果目录；提交内保留数值矩阵和成长统计。旧 JSON 报告及外部审计目录是历史记录。

## 口径

- 初始状态 `ready`，开始后 `playing`。系统失焦不自动恢复，需用户明确继续；隐藏页面拒绝恢复。
- 伤害累计字段是 `stats.totalDamage`，为命中总量（包括护盾和溢出伤害）；`highestHit` 记录单次完整命中，与浮字绘制无关。
- 浮字上限统一 25；粒子移动预算 120、桌面 250；冲击波移动 20、桌面 35。池满时优先淘汰普通特效；全高优先级池拒绝普通新项。
- 黑洞/光束 tick 结算包含寿命端点，排除端点之后；生产单帧 dt 上限 0.1 秒。每帧最多补 4 次 tick，极端超范围 dt 不承诺完全补偿。
- 10 秒 DPS 使用真实武器类和 evolve()，固定冷启动、逻辑时钟、种子与靶条件；移动靶/群体靶单列。60 秒持续接触验证独立检查计时，不混入小靶旋转采样误差。
- 成长模拟实际点选当前发出的卡，不重新抽卡挑最优。比较均衡、存活、输出、进化四种策略；未到达里程碑的样本单列，不混进时间中位数。
- 压测 CPU 数值是逻辑更新和 Canvas 提交耗时，不能等同于 GPU 完成或真机 FPS。音效检查使用真实 AudioContext 和 ended/disconnect 事件。
- 未执行 iOS/Android 真机、GPU 性能和长时间内存验收；游戏界面 seed 暂不保证回放，因为 Math.random 仍混用于玩法与表现。

## 后续设计项

卫星维持环形覆盖；范围升级可扩大内圈空区，具体热区和超频/范围组合见当前基准。相机明显滞后时的刷怪落点仍可能在实际视口内，诊断保留该结果。上述事项不应写成已完成的全盘覆盖或全场景离屏保证。
