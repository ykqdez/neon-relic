# 《霓虹遗迹 Neon Relic》测试与验证备忘录 (Test Notes)

本文档记录了《霓虹遗迹 Neon Relic》在开发各阶段的测试用例、自动化与真机/无头浏览器验证结果。

---

## 一、自动化与运行时测试 (Headless CDP Automation)

通过 Microsoft Edge 无头浏览器配合 Chrome DevTools Protocol (CDP) WebSocket 进行了全链路自动化系统测试：

| 测试项 | 验证内容 | 测试结果 | 备注 |
| :--- | :--- | :---: | :--- |
| **T1. 引擎初始化** | `window.gameInstance` 全局实例构建及状态机初始为 `playing` | ✅ PASS | 画布挂载正常，视网膜 DPR 缩放正确 |
| **T2. 玩家实体与属性** | 初始 HP 100/100，基础移速 175，等级 Lv.1，经验 0/12 | ✅ PASS | 护甲减免公式 `DR = Armor / (Armor + 40)` 计算正常 |
| **T3. 武器库注册** | 6 大武器 (`pulse_blade`, `arc_core`, `orbital_satellites`, `plasma_cannon`, `black_hole`, `prism_ray`) 正确挂载 | ✅ PASS | 初始解锁脉冲刃 Lv.1 |
| **T4. 输入与移动系统** | 设置输入向量 `(1, 0)`，玩家坐标正常位移，边界限制生效 | ✅ PASS | 键盘 WASD / 虚拟摇杆双向桥接正常 |
| **T5. 索敌与伤害计算** | 脉冲刃自动锁定范围内敌人并造成伤害，血量正确削减 | ✅ PASS | 浮动伤害数字、受击闪红与打击粒子正常触发 |
| **T6. 经验与三选一** | 增加经验触发升级，游戏平滑挂起，弹出 3 张升级卡片 | ✅ PASS | 稀有度权重与等级状态渲染正确 |
| **T7. 升级卡点击与生效** | 选取卡片后属性立即刷新，弹窗淡出，游戏无缝恢复 | ✅ PASS | 武器/芯片等级成功递增 |
| **T8. 挂起与生命周期** | `togglePause()` 与 `resumeGame()` 状态切换 | ✅ PASS | 切后台/锁屏自动暂停无死锁 |
| **T9. 多阶段 Boss 机制** | 遗迹泰坦 100%~66% 环形弹幕，66%~33% 践踏召唤，33%~0% 危险红圈与暴怒 | ✅ PASS | 阶段随 HP 阈值动态切换 |
| **T10. 武器终极进化** | 满级脉冲刃 + 聚焦透镜，正确刷出「光子幻刃 (进化)」卡片 | ✅ PASS | 进化后攻击形态与音效彻底蜕变 |

---

## 二、移动端适配与防误触测试 (Mobile & Touch Verification)

1. **视网膜高分屏 (Retina / OLED) 适配**：
   - 使用 `window.devicePixelRatio` 对 Canvas 内部物理像素进行缩放：`canvas.width = w * dpr; ctx.scale(dpr, dpr);`。
   - 在高 DPI 手机屏幕上矢量几何图形、字体与特效均极其锐利，无模糊毛边。
2. **手势与下拉刷新拦截**：
   - CSS 配置：`touch-action: none; overscroll-behavior: none; user-select: none;`。
   - JavaScript 在 `touchmove` 事件中添加 `{ passive: false }` 并调用 `e.preventDefault()`，彻底杜绝微信、Safari 等移动浏览器的“橡皮筋下拉刷新”与页面意外滑动。
3. **触控目标规范 (44x44px)**：
   - 暂停按钮、声音切换按钮、卡片点击区域均严格保证 $\ge 44 \times 44\text{ px}$ 触控范围。
4. **横竖屏自适应**：
   - 响应 `resize` 与 `orientationchange` 事件，自动重新计算视口宽高与相机视锥，玩家始终处于屏幕中心，不会被拉伸变形或掉出地图边界。

---

## 三、性能与同屏敌人压力测试 (Performance & Pooling)

- **对象池复用**：
  - 粒子池：上限 250，超时自动回收。
  - 浮动伤害数字：上限 50，先入先出队列。
  - 经验晶体：上限 180，超过时自动将附近低价值绿色晶体聚合为紫色/金色高价值晶体，彻底消除碎片数量堆积。
  - 敌人数上限：硬上限 150，确保即使在百怪同屏大后期，移动端仍能保持稳定 60 FPS。
- **Web Audio API**：
  - 纯代码算法合成，零网络请求与音频文件解码开销；
  - 采用轻触解锁机制，完美规避移动端浏览器 Autoplay 限制。
