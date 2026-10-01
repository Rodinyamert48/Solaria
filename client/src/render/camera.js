// İzometrik ortografik kamera: kaydır, yakınlaştır, döndür (yumuşak geçişli)
import { ArcRotateCamera, Camera, Vector3 } from './babylon.js';

// Dikeyden açı: izometrik (~55°), yukarıdan (~40°), alçak (~66°)
export const CAMERA_ANGLES = { izometrik: 0.96, yukaridan: 0.7, alcak: 1.15 };
const BETA = CAMERA_ANGLES.izometrik;
const MIN_ZOOM = 4;
const MAX_ZOOM = 75;

export class IsoCamera {
  constructor(scene, canvas) {
    this.scene = scene;
    this.canvas = canvas;
    this.camera = new ArcRotateCamera('cam', -Math.PI / 4, BETA, 250, Vector3.Zero(), scene);
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 1;
    this.camera.maxZ = 1200;
    this.camera.inputs.clear();

    this.alpha = this.camera.alpha;
    this.beta = BETA;
    this.zoom = 22;
    this.target = Vector3.Zero();
    this.goal = { alpha: this.alpha, beta: BETA, zoom: this.zoom, target: this.target.clone() };
    this.keys = new Set();
    this.bounds = { minX: -100, maxX: 100, minZ: -70, maxZ: 70 };

    this.bindInput();
  }

  // Ekran pikseli başına dünya birimi
  get unitsPerPixel() {
    return (this.zoom * 2) / this.canvas.clientHeight;
  }

  forwardRight() {
    const a = this.camera.alpha;
    // ArcRotate: kamera konumu = target + (cos a, ., sin a) * r -> bakış yönü tersi
    const forward = new Vector3(-Math.cos(a), 0, -Math.sin(a));
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();
    return { forward, right };
  }

  pan(dxPx, dyPx) {
    const { forward, right } = this.forwardRight();
    const u = this.unitsPerPixel;
    this.goal.target.addInPlace(right.scale(-dxPx * u));
    this.goal.target.addInPlace(forward.scale((dyPx * u) / Math.cos(this.beta)));
    this.clamp();
  }

  clamp() {
    const t = this.goal.target;
    t.x = Math.min(this.bounds.maxX, Math.max(this.bounds.minX, t.x));
    t.z = Math.min(this.bounds.maxZ, Math.max(this.bounds.minZ, t.z));
    t.y = 0;
  }

  setAngle(name) {
    this.goal.beta = CAMERA_ANGLES[name] ?? BETA;
  }

  zoomBy(factor) {
    this.goal.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.goal.zoom * factor));
  }

  rotateBy(rad) {
    this.goal.alpha += rad;
  }

  snapRotate(dir) {
    const step = Math.PI / 2;
    const base = Math.round((this.goal.alpha + Math.PI / 4) / step) * step - Math.PI / 4;
    this.goal.alpha = base + dir * step;
  }

  focus(point, zoom) {
    this.goal.target.copyFrom(point);
    this.goal.target.y = 0;
    if (zoom) this.goal.zoom = zoom;
    this.clamp();
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(e.deltaY * 0.0012));
    }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    // Fare/dokunma: sol sürükle = kaydır, sağ/orta sürükle = döndür, iki parmak = yakınlaştır + döndür
    this.pointers = new Map();
    this.dragging = false;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, button: e.button });
      this.dragging = false;
      if (this.pointers.size === 2) this.pinch = this.pinchState();
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) this.dragging = true;
      if (this.pointers.size === 2) {
        const s = this.pinchState();
        if (this.pinch) {
          this.zoomBy(this.pinch.dist / Math.max(1, s.dist));
          this.rotateBy(s.angle - this.pinch.angle);
          this.pan((s.cx - this.pinch.cx) * 1, (s.cy - this.pinch.cy) * 1);
        }
        this.pinch = s;
        this.dragging = true;
        return;
      }
      if (!this.dragging) return;
      if (p.button === 2 || p.button === 1) this.rotateBy(-dx * 0.006);
      else if (this.allowLeftPan?.() !== false) this.pan(dx, dy);
    });
    const up = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'q') this.snapRotate(1);
      else if (k === 'e') this.snapRotate(-1);
      else if (k === '+' || k === '=') this.zoomBy(0.85);
      else if (k === '-') this.zoomBy(1.18);
      else this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  }

  update(dt) {
    // Klavye ile kaydırma
    const speed = 900 * dt;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) dy += speed;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy -= speed;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx += speed;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx -= speed;
    if (dx || dy) this.pan(dx, dy);

    const k = 1 - Math.exp(-dt * 10);
    this.alpha += (this.goal.alpha - this.alpha) * k;
    this.beta += (this.goal.beta - this.beta) * k;
    this.zoom += (this.goal.zoom - this.zoom) * k;
    Vector3.LerpToRef(this.target, this.goal.target, k, this.target);

    const cam = this.camera;
    cam.alpha = this.alpha;
    cam.beta = this.beta;
    cam.target.copyFrom(this.target);
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    cam.orthoTop = this.zoom;
    cam.orthoBottom = -this.zoom;
    cam.orthoLeft = -this.zoom * aspect;
    cam.orthoRight = this.zoom * aspect;
  }
}
