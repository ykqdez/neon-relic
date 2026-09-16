# 素材鸣谢与许可

全部素材随项目本地分发；游戏运行时不访问素材网站。下载日期：2026-09-16。

| 素材 | 作者 / 来源 | 许可 | 本项目用途 |
| --- | --- | --- | --- |
| Tiny Dungeon 1.0 | [Kenney](https://kenney.nl/assets/tiny-dungeon) | CC0 1.0 | 玩家、六类敌人、Boss、装备图标、地板装饰。使用原始 packed 图集，在 Canvas/CSS 中裁取、缩放与翻转。 |
| Digital Audio | [Kenney](https://kenney.nl/assets/digital-audio) | CC0 1.0 | 12 个原始 OGG：射击、命中、击杀、拾取、升级、进化、受伤、Boss 提示。仅在播放时调整增益和音高。 |
| 16x16 Explosion | [BitingChaos / OpenGameArt](https://opengameart.org/content/16x16-explosion) | CC0 1.0 | 五帧原始 PNG，用于 Boss 爆炸与超新星重要反馈。 |
| 5 Chiptunes (Action) — Level 1 | [Juhani Junkala / SubspaceAudio](https://opengameart.org/content/5-chiptunes-action) | CC0 1.0 | 原始 `level1.mp3` 本地重命名为 `relic-run.mp3`；低音量循环战斗 BGM，暂停、失焦、选卡及静音时暂停。 |
| Fusion Pixel Font 12px Proportional / 简体中文 | [TakWolf 与字体贡献者](https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.09.01) | SIL OFL 1.1 | 原始 `fusion-pixel-12px-proportional-zh_hans.otf.woff2`，未修改。中文、拉丁字符及数字像素字体。 |

## 下载与授权证据

### 武器音效分配

复用上表 Digital Audio 的原始采样，播放时调整音高与增益；基础与进化形态共享对应音色，进化音高降低 15%。

| 武器 | 采样 | 发声时机 |
| --- | --- | --- |
| 脉冲刃 | `laser1.ogg` | 斩击释放 |
| 电弧核心 | `zap1.ogg` | 连锁电击 / 天罚落雷 |
| 轨道卫星 | `zap2.ogg` | 卫星核心 / 进化力场实际接触敌人 |
| 等离子炮 | `spaceTrash1.ogg` | 每轮炮弹发射 |
| 黑洞发生器 | `phaserDown1.ogg` | 黑洞生成；超新星结束爆炸保留独立爆炸声 |
| 棱镜射线 | `laser5.ogg` | 每轮射线释放 |

每种武器独立限频，最多并发 2 个攻击采样；全局声音节点上限仍为 20。BGM 播放音量从 13% 降至 4%，不改变原始音频文件。

### 许可文件

- Kenney 原包附带许可：`licenses/kenney-tiny-dungeon.txt`、`licenses/kenney-digital-audio.txt`。
- OpenGameArt 作者页面明确标为 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)；作者与文件映射另存于 `licenses/opengameart-cc0.txt`。
- 字体发行包中的 `OFL.txt` 和上游 `LICENSES/` 完整保存在 `licenses/fusion-pixel/`。字体许可仅适用于字体，不改变游戏代码的许可。
- `manifest.json` 记录每个实际使用的二进制文件、来源、许可、大小与 SHA-256，供自动检查本地完整性。

像素斩击、电弧、射线、引力螺旋、危险区、地面网格和 UI 边框由项目原生 Canvas/CSS 绘制，与上述精灵组合；这些效果不来自第三方素材包。没有购买素材、使用付费资源或把来源不明的图片纳入项目。
