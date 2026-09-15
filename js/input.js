/**
 * 《霓虹遗迹 Neon Relic》- 输入控制系统
 * 手机端动态虚拟摇杆 (支持多点触控与单手操作) + 桌面端键盘 (WASD / 方向键)
 */

class InputManager {
  constructor(canvas, joystickContainer, joystickKnob) {
    this.canvas = canvas;
    this.joystickContainer = joystickContainer;
    this.joystickKnob = joystickKnob;

    // 当前移动向量 (-1 到 1)
    this.vector = { x: 0, y: 0, magnitude: 0 };

    // 触摸追踪状态
    this.touchId = null;
    this.basePos = { x: 0, y: 0 };
    this.maxRadius = 45; // 摇杆最大偏移半径

    // 键盘状态
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false
    };

    this.initKeyboard();
    this.initTouch();
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      // 首次按键尝试激活音频
      if (window.soundSystem) window.soundSystem.unlock();

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.up = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.down = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'Escape':
        case 'KeyP':
          if (window.gameInstance) window.gameInstance.togglePause();
          break;
      }
      this.updateKeyboardVector();
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.up = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.down = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
      }
      this.updateKeyboardVector();
    });
  }

  updateKeyboardVector() {
    let kx = 0;
    let ky = 0;
    if (this.keys.up) ky -= 1;
    if (this.keys.down) ky += 1;
    if (this.keys.left) kx -= 1;
    if (this.keys.right) kx += 1;

    // 只有在未触摸操控时由键盘接管
    if (this.touchId === null) {
      if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        this.vector.x = kx / len;
        this.vector.y = ky / len;
        this.vector.magnitude = 1;
      } else {
        this.vector.x = 0;
        this.vector.y = 0;
        this.vector.magnitude = 0;
      }
    }
  }

  initTouch() {
    // 拦截全局触摸移动防页面滚动
    document.addEventListener('touchmove', (e) => {
      if (e.target === this.canvas || e.target.closest('#hud-overlay')) {
        e.preventDefault();
      }
    }, { passive: false });

    // 画布触摸事件监听
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });
  }

  handleTouchStart(e) {
    e.preventDefault();
    if (window.soundSystem) window.soundSystem.unlock();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      // 允许屏幕任意位置（通常是偏左或中间）快速拉出摇杆
      if (this.touchId === null) {
        this.touchId = touch.identifier;
        this.basePos.x = touch.clientX;
        this.basePos.y = touch.clientY;

        if (this.joystickContainer) {
          this.joystickContainer.style.left = `${this.basePos.x}px`;
          this.joystickContainer.style.top = `${this.basePos.y}px`;
          this.joystickContainer.style.display = 'block';
          if (this.joystickKnob) {
            this.joystickKnob.style.transform = 'translate(0px, 0px)';
          }
        }
        break;
      }
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (this.touchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        const dx = touch.clientX - this.basePos.x;
        const dy = touch.clientY - this.basePos.y;
        const dist = Math.hypot(dx, dy);

        if (dist === 0) {
          this.vector.x = 0;
          this.vector.y = 0;
          this.vector.magnitude = 0;
          if (this.joystickKnob) this.joystickKnob.style.transform = 'translate(0px, 0px)';
        } else {
          const clampedDist = Math.min(dist, this.maxRadius);
          const nx = dx / dist;
          const ny = dy / dist;

          this.vector.x = nx;
          this.vector.y = ny;
          this.vector.magnitude = clampedDist / this.maxRadius;

          const knobX = nx * clampedDist;
          const knobY = ny * clampedDist;
          if (this.joystickKnob) {
            this.joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
          }
        }
        break;
      }
    }
  }

  handleTouchEnd(e) {
    if (this.touchId === null) return;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.touchId = null;
        this.vector.x = 0;
        this.vector.y = 0;
        this.vector.magnitude = 0;

        if (this.joystickContainer) {
          this.joystickContainer.style.display = 'none';
        }
        // 如果松手后仍有键盘按键按住，切回键盘
        this.updateKeyboardVector();
        break;
      }
    }
  }

  getVector() {
    return this.vector;
  }
}

window.InputManager = InputManager;
