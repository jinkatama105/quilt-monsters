// input.js — keyboard and mouse: the canvas is scaled to the viewport, so
// everything reports view-space coordinates (1280x800) to the screens.
import { VIEW_W, VIEW_H } from './config.js?v=run3';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();          // edge-triggered, cleared each frame
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * VIEW_W;
      this.mouse.y = ((e.clientY - r.top) / r.height) * VIEW_H;
    });
    canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
    canvas.addEventListener('mouseup', () => { this.mouse.down = false; this.mouse.clicked = true; });
    canvas.addEventListener('mouseleave', () => { this.mouse.down = false; });
  }

  down(key) { return this.keys.has(key); }
  hit(key) { return this.pressed.has(key); }

  /** WASD or arrows -> {dx, dy} or null. Held keys win; a fresh press edge also counts. */
  moveVector() {
    let dx = 0, dy = 0;
    const held = (k) => this.down(k);
    const edge = (k) => this.pressed.has(k);
    if (held('a') || held('arrowleft') || edge('a') || edge('arrowleft')) dx -= 1;
    if (held('d') || held('arrowright') || edge('d') || edge('arrowright')) dx += 1;
    if (held('w') || held('arrowup') || edge('w') || edge('arrowup')) dy -= 1;
    if (held('s') || held('arrowdown') || edge('s') || edge('arrowdown')) dy += 1;
    if (dx !== 0 && dy !== 0) dy = 0; // horizontal priority keeps steps orthogonal
    if (dx === 0 && dy === 0) return null;
    return { dx, dy };
  }

  /** True when the view-space point is inside a rect; handy for buttons. */
  inRect(x, y, w, h) {
    return this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h && this.mouse.clicked;
  }

  endFrame() { this.pressed.clear(); this.mouse.clicked = false; }
}
