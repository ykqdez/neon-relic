# 素材鸣谢与许可

全部素材随项目本地分发；游戏运行时不访问素材网站。下载日期：2026-09-16。

| 素材 | 作者 / 来源 | 许可 | 本项目用途 |
| --- | --- | --- | --- |
| Tiny Dungeon 1.0 | [Kenney](https://kenney.nl/assets/tiny-dungeon) | CC0 1.0 | 玩家、八类敌人、Boss、装备图标、地板装饰。使用原始 packed 图集，在 Canvas/CSS 中裁取、缩放与翻转。 |
| Digital Audio | [Kenney](https://kenney.nl/assets/digital-audio) | CC0 1.0 | 保留 12 个原始 OGG 供溯源，运行时使用转码后的单声道 16-bit PCM WAV；采样率、时长及幅度保持不变。旧升级提示采样不再触发。 |
| Plasma shot / Enemy shatter / Orbital contact / Blade swish / Prism beam | 本项目 [生成脚本](../tools/build_audio.py) | CC0 1.0 | 原创合成的能量炮、碎裂、护盾轻撞、挥刃和持续射线音效，预先生成为 WAV，不在战斗中合成。 |
| Thunder | [Jerimee / OpenGameArt](https://opengameart.org/content/thunder) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 电弧雷击声。截取原始 `thunder-seq.wav` 的 1.48–2.33 秒，转单声道、归一化及淡入淡出；保留作者署名，详细说明见 `licenses/jerimee-thunder.txt`。 |
| 16x16 Explosion | [BitingChaos / OpenGameArt](https://opengameart.org/content/16x16-explosion) | CC0 1.0 | 五帧原始 PNG，用于 Boss 爆炸与超新星重要反馈。 |
| 5 Chiptunes (Action) — Level 1 | [Juhani Junkala / SubspaceAudio](https://opengameart.org/content/5-chiptunes-action) | CC0 1.0 | 原始 `level1.mp3` 本地重命名为 `relic-run.mp3`；低音量循环 BGM，选卡期间继续，暂停、失焦及静音时暂停。 |
| Fusion Pixel Font 12px Proportional / 简体中文 | [TakWolf 与字体贡献者](https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.09.01) | SIL OFL 1.1 | 原始 `fusion-pixel-12px-proportional-zh_hans.otf.woff2`，未修改。中文、拉丁字符及数字像素字体。 |

## 下载与授权证据

### 武器音效分配

使用上表采样，播放时调整音高与增益；基础与进化形态共享对应音色，进化音高降低 15%。全部运行时音效使用 PCM WAV，避免旧 iOS 的 OGG 解码限制。

| 武器 | 采样 | 发声时机 |
| --- | --- | --- |
| 脉冲刃 | `blade-swish.wav` | 斩击释放 |
| 电弧核心 | `lightning-crack.wav` | 连锁电击 / 天罚落雷 |
| 轨道卫星 | `orbital-contact.wav` | 核心 / 力场接触敌人或抵消子弹；空转无声 |
| 等离子炮 | `plasma-shot.wav` | 每轮能量弹发射 |
| 黑洞发生器 | `phaserDown1.wav` | 黑洞生成；超新星结束爆炸保留独立爆炸声 |
| 棱镜射线 | `prism-beam.wav` | 每轮射线释放 |

敌人死亡使用 `enemy-shatter.wav`，普通、精英、Boss 使用不同音高与音量；群体击杀共享限频，避免一批敌人死亡叠成爆音。

每种武器独立限频，最多并发 2 个攻击采样，武器合计最多 8 声；普通战斗组最多 12 声，重要提示组最多 4 声，全局另有 20 声硬上限。BGM 播放音量为 4%。完整混音规则见 [声音设计](../docs/AUDIO_DESIGN.md)。

### 许可文件

- Kenney 原包附带许可：`licenses/kenney-tiny-dungeon.txt`、`licenses/kenney-digital-audio.txt`。
- 转码说明与五项原创合成音效许可：`licenses/generated-sfx.txt`。离线重新生成需要 Python 与 soundfile，执行 `python tools/build_audio.py`；游戏运行不需要 Python 或额外依赖。
- OpenGameArt 的爆炸和 BGM 作者页面标为 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)；文件映射见 `licenses/opengameart-cc0.txt`。Thunder 雷击声使用 CC BY 3.0，作者及改编说明见 `licenses/jerimee-thunder.txt`。
- 字体发行包中的 `OFL.txt` 和上游 `LICENSES/` 完整保存在 `licenses/fusion-pixel/`。字体许可仅适用于字体，不改变游戏代码的许可。
- `manifest.json` 记录每个实际使用的二进制文件、来源、许可、大小与 SHA-256，供自动检查本地完整性。

像素斩击、电弧、射线、引力螺旋、危险区、地面网格和 UI 边框由项目原生 Canvas/CSS 绘制，与上述精灵组合；这些效果不来自第三方素材包。没有购买素材、使用付费资源或把来源不明的图片纳入项目。
