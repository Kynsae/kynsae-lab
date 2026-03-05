import { Component, ElementRef, HostListener, Input, NgZone, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import * as THREE from 'three';

const T = THREE as any;

@Component({
  selector: 'app-star-rain',
  imports: [],
  templateUrl: './star-rain.html',
  styleUrl: './star-rain.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StarRain implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(60, 1, 0.1, 2000);
  private renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  // No postprocessing composer; trails drawn as line segments

  private rafId = 0;
  private resizeScheduled = false;
  private isVisible = true;
  private lastRenderedProgress01 = -1;
  private lastFrameTimeMs = performance.now();
  private trailHalfLifeSeconds = 0.18; // unused with distance-based trails (kept for fallback)
  private trailLengthWorld = 10; // target spatial trail length in world units (shorter)
  private currentProgress01 = 0;
  private maxProgressRatePerSecond = 2.0; // limit how fast progress can change to avoid gaps

  private stars!: any;
  private startPositions!: Float32Array;
  private endPositions!: Float32Array;
  private positions!: Float32Array;
  private starCount = 450;
  private avgPathLengthWorld = 1;
  private directions!: Float32Array; // normalized direction per star
  private trailLayers: { positions: Float32Array; lines: any; lengthScale: number; mat: any; baseOpacity: number; t: number; }[] = [];
  private pointsMaterial!: any;
  private starBuckets: { positions: Float32Array; geometry: any; points: any; material: any; indices: number[]; fadeOffset: number; }[] = [];
  private idxToBucket!: Uint16Array;
  private idxToOffset!: Uint32Array;
  private pointSizeWorld = 0.08;
  private headColor = new T.Color(0x66b3ff);
  private tailColor = new T.Color(0x1f3eff);
  private trailOpacityScale = 1.0;
  // duplicate removed

  private _percentage = 0; // 0..100
  private progress01 = 0; // 0..1

  constructor(private ngZone: NgZone) {}

  @Input() set percentage(value: number) {
    this.updateProgress(value);
  }

  // Alias used by the experiments container, which passes "progress"
  @Input() set progress(value: number) {
    this.updateProgress(value);
  }

  // Live-tunable inputs from the settings panel
  @Input() set trailLength(value: number) {
    this.trailLengthWorld = Math.max(1, value);
    this.requestRender();
  }

  @Input() set trailThickness(value: number) {
    this.trailOpacityScale = Math.max(0, value);
    this.requestRender();
  }

  @Input() set pointSize(value: number) {
    const clamped = Math.max(0.01, value);
    this.pointSizeWorld = clamped;
    if (this.pointsMaterial) {
      this.pointsMaterial.size = clamped;
    }
    for (const bucket of this.starBuckets) {
      if (bucket.material) {
        bucket.material.size = clamped;
      }
    }
    this.requestRender();
  }

  @Input() set headColorHex(value: string) {
    this.setHeadColor(value);
  }

  @Input() set tailColorHex(value: string) {
    this.setTailColor(value);
  }

  private setHeadColor(value: string): void {
    try {
      this.headColor.set(value);
      this.updateColors();
      this.requestRender();
    } catch {
      // ignore invalid color
    }
  }

  private setTailColor(value: string): void {
    try {
      this.tailColor.set(value);
      this.updateColors();
      this.requestRender();
    } catch {
      // ignore invalid color
    }
  }

  private updateColors(): void {
    if (this.pointsMaterial) {
      this.pointsMaterial.color.copy(this.headColor);
    }
    for (const layer of this.trailLayers) {
      const layerColor = this.tailColor.clone().lerp(this.headColor, layer.t);
      layer.mat.color.copy(layerColor);
    }
    for (const bucket of this.starBuckets) {
      bucket.material.color.copy(this.headColor);
    }
  }

  private updateProgress(value: number): void {
    const clamped = Math.min(100, Math.max(0, Number.isFinite(value as number) ? value : 0));
    this._percentage = clamped;
    this.progress01 = clamped / 100;
    this.ensureRunning();
  }

  ngOnInit(): void {
    this.initScene();
    this.initStars();
    this.ngZone.runOutsideAngular(() => this.startAnimation());
  }

  private initScene(): void {
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));

    // Size the renderer to the container rather than the full window
    const container = this.containerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;

    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);

    this.camera.aspect = width / height;
    this.camera.position.set(0, 0, 60);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    container.appendChild(this.renderer.domElement);
    // Ensure the canvas fills the container for proper centering
    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  private initStars(): void {
    const geometry = new T.BufferGeometry();
    const count = this.starCount;

    this.startPositions = new Float32Array(count * 3);
    this.endPositions = new Float32Array(count * 3);
    this.positions = new Float32Array(count * 3);

    

    // Start positions: offscreen bottom band (spawn fully below view)
    const startDistance = 40;
    const right = new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const up = new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    const forward = new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2).normalize();
    const startFrustumHeight = 2 * Math.tan(T.MathUtils.degToRad(this.camera.fov * 0.5)) * startDistance;

    // End positions: computed to pass through screen center (0,0) at random depth
    const destDistance = 60;

    let pathLenSum = 0;
    for (let i = 0; i < count; i++) {
      // Offscreen start band and end beyond center so path crosses center
      const startNdcX = (Math.random() - 0.5) * 2.2; // span ~220% width for more dispersion
      const startNdcY = -1 - (0.20 + Math.random() * 0.45); // 0.20..0.65 below screen
      const startDepth = startDistance * (0.70 + Math.random() * 1.1); // wider per-star depth jitter
      const startPos = this.getWorldPointOnScreen(startNdcX, startNdcY, startDepth);
      // extra world-space jitter at start
      startPos.addScaledVector(right, (Math.random() - 0.5) * startFrustumHeight * 0.15);
      startPos.addScaledVector(up, (Math.random() - 0.5) * startFrustumHeight * 0.15);
      const centerDepth = 50 + (Math.random() - 0.5) * 20; // 40..60
      const centerWorld = this.getWorldPointOnScreen(0, 0, centerDepth);
      const dirThroughCenter = centerWorld.clone().sub(startPos);
      const alpha = 1.2 + Math.random() * 1.6;
      const endPos = centerWorld.clone().addScaledVector(dirThroughCenter, alpha);

      const ix = i * 3;
      this.startPositions[ix + 0] = startPos.x;
      this.startPositions[ix + 1] = startPos.y;
      this.startPositions[ix + 2] = startPos.z;

      this.endPositions[ix + 0] = endPos.x;
      this.endPositions[ix + 1] = endPos.y;
      this.endPositions[ix + 2] = endPos.z;

      this.positions[ix + 0] = this.startPositions[ix + 0];
      this.positions[ix + 1] = this.startPositions[ix + 1];
      this.positions[ix + 2] = this.startPositions[ix + 2];

      // store normalized direction and accumulate length
      const dx = endPos.x - startPos.x;
      const dy = endPos.y - startPos.y;
      const dz = endPos.z - startPos.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      if (!this.directions) this.directions = new Float32Array(count * 3);
      this.directions[ix + 0] = dx / len;
      this.directions[ix + 1] = dy / len;
      this.directions[ix + 2] = dz / len;
      pathLenSum += len;
    }

    this.avgPathLengthWorld = count > 0 ? pathLenSum / count : 1;

    const pointsAttr = new T.BufferAttribute(this.positions, 3);
    pointsAttr.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('position', pointsAttr);

    const material = new T.PointsMaterial({
      color: this.headColor.getHex(),
      size: this.pointSizeWorld,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: T.AdditiveBlending
    });

    this.pointsMaterial = material;
    this.stars = new T.Points(geometry, material);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // fixed-length trail lines with layered fade (more layers for smoother gradient)
    const layersCount = 10;
    const tailScale = 1.0;  // far tail length factor
    const headScale = 0.25; // near head length factor
    const opacityTail = 0.035; // faint tail
    const opacityHead = 0.12;  // brighter near head
    for (let i = 0; i < layersCount; i++) {
      const t = layersCount <= 1 ? 1 : (i / (layersCount - 1)); // 0..1 tail->head
      const scale = tailScale + (headScale - tailScale) * t;
      const opacity = opacityTail + (opacityHead - opacityTail) * t;
      const layerColor = this.tailColor.clone().lerp(this.headColor, t);
      const positions = new Float32Array(count * 2 * 3);
      const lineGeom = new T.BufferGeometry();
      const lineAttr = new T.BufferAttribute(positions, 3);
      lineAttr.setUsage(T.DynamicDrawUsage);
      lineGeom.setAttribute('position', lineAttr);
      const lineMat = new T.LineBasicMaterial({
        color: layerColor.getHex(),
        transparent: true,
        opacity,
        depthWrite: false,
        blending: T.AdditiveBlending
      });
      const lines = new T.LineSegments(lineGeom, lineMat);
      lines.frustumCulled = false;
      this.trailLayers.push({ positions, lines, lengthScale: scale, mat: lineMat, baseOpacity: opacity, t });
      this.scene.add(lines);
    }

    // Build star buckets for randomized opacity fade
    this.pointsMaterial.opacity = 0; // buckets control star opacity
    const bucketsCount = 6;
    const bucketIndices: number[][] = Array.from({ length: bucketsCount }, () => []);
    this.idxToBucket = new Uint16Array(count);
    for (let i = 0; i < count; i++) {
      const b = (Math.random() * bucketsCount) | 0;
      bucketIndices[b].push(i);
      this.idxToBucket[i] = b;
    }
    this.idxToOffset = new Uint32Array(count);
    for (let b = 0; b < bucketsCount; b++) {
      const indices = bucketIndices[b];
      const positions = new Float32Array(indices.length * 3);
      const geom = new T.BufferGeometry();
      const attr = new T.BufferAttribute(positions, 3);
      attr.setUsage(T.DynamicDrawUsage);
      geom.setAttribute('position', attr);
      const mat = new T.PointsMaterial({
        color: this.headColor.getHex(),
        size: this.pointSizeWorld,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: T.AdditiveBlending
      });
      const pts = new T.Points(geom, mat);
      pts.frustumCulled = false;
      for (let j = 0; j < indices.length; j++) this.idxToOffset[indices[j]] = j * 3;
      const fadeOffset = (Math.random() - 0.5) * 0.12;
      this.starBuckets.push({ positions, geometry: geom, points: pts, material: mat, indices, fadeOffset });
      this.scene.add(pts);
    }
  }

  private getWorldPointOnScreen(ndcX: number, ndcY: number, distanceFromCamera: number): any {
    const ndc = new T.Vector3(ndcX, ndcY, 0.5);
    ndc.unproject(this.camera);
    const rayDir = ndc.sub(this.camera.position).normalize();
    return this.camera.position.clone().add(rayDir.multiplyScalar(distanceFromCamera));
  }

  private updateStarPositions(progress01: number): void {
    const pos = this.positions;
    const a = this.startPositions;
    const b = this.endPositions;
    const t = progress01;
    const it = 1 - t;
    for (let i = 0, i3 = 0; i < this.starCount; i++, i3 += 3) {
      pos[i3 + 0] = a[i3 + 0] * it + b[i3 + 0] * t;
      pos[i3 + 1] = a[i3 + 1] * it + b[i3 + 1] * t;
      pos[i3 + 2] = a[i3 + 2] * it + b[i3 + 2] * t;
    }
    (this.stars.geometry.attributes['position'] as THREE.BufferAttribute).needsUpdate = true;

    // Update layered fixed-length trail segments (tail -> head)
    const dir = this.directions;
    for (const layer of this.trailLayers) {
      const lp = layer.positions;
      const L = this.trailLengthWorld * layer.lengthScale;
      for (let i = 0, i3 = 0, l3 = 0; i < this.starCount; i++, i3 += 3, l3 += 6) {
        const hx = pos[i3 + 0];
        const hy = pos[i3 + 1];
        const hz = pos[i3 + 2];
        const dx = dir[i3 + 0];
        const dy = dir[i3 + 1];
        const dz = dir[i3 + 2];
        let tx = hx - dx * L;
        let ty = hy - dy * L;
        let tz = hz - dz * L;
        // clamp tail not before start
        const sx = a[i3 + 0];
        const sy = a[i3 + 1];
        const sz = a[i3 + 2];
        const vx = hx - sx;
        const vy = hy - sy;
        const vz = hz - sz;
        const along = vx * dx + vy * dy + vz * dz;
        if (along < L) {
          tx = sx;
          ty = sy;
          tz = sz;
        }
        // write line segment (tail, head)
        lp[l3 + 0] = tx;
        lp[l3 + 1] = ty;
        lp[l3 + 2] = tz;
        lp[l3 + 3] = hx;
        lp[l3 + 4] = hy;
        lp[l3 + 5] = hz;
      }
      (layer.lines.geometry.attributes['position'] as THREE.BufferAttribute).needsUpdate = true;
    }

    // Update bucketed star positions
    for (const bucket of this.starBuckets) {
      const bpos = bucket.positions;
      for (let j = 0; j < bucket.indices.length; j++) {
        const idx = bucket.indices[j];
        const i3 = idx * 3;
        const o = j * 3;
        bpos[o + 0] = pos[i3 + 0];
        bpos[o + 1] = pos[i3 + 1];
        bpos[o + 2] = pos[i3 + 2];
      }
      (bucket.geometry.attributes['position'] as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private animate = (): void => {
    const now = performance.now();
    const dtRaw = (now - this.lastFrameTimeMs) / 1000;
    const dt = dtRaw > 0.1 ? 0.1 : (dtRaw < 0 ? 0 : dtRaw);
    this.lastFrameTimeMs = now;

    // Pause when no movement so trails stay visible
    if (this.lastRenderedProgress01 >= 0) {
      const diff = Math.abs(this.progress01 - this.lastRenderedProgress01);
      if (diff < 0.00001) {
        this.stopAnimation();
        return;
      }
    }

    // Determine sub-steps based on progress delta to keep trails continuous
    // Apply a rate limiter so progress advances smoothly even when input jumps
    const target = this.progress01;
    const rate = Math.max(0.1, this.maxProgressRatePerSecond);
    const maxStep = rate * dt;
    let next = this.currentProgress01;
    const diffToTarget = target - next;
    if (Math.abs(diffToTarget) > maxStep) {
      next += Math.sign(diffToTarget) * maxStep;
    } else {
      next = target;
    }

    // Smooth opacity fade-in (10%..30%) and fade-out (80%..100%)
    const fadeInStart = 0.0;
    const fadeInEnd = 0.1;
    const fadeOutStart = 0.8;
    const fadeOutEnd = 1.0;

    // Trails use uniform fade windows
    const sIn = (next - fadeInStart) / Math.max(1e-6, (fadeInEnd - fadeInStart));
    const sInClamped = sIn < 0 ? 0 : (sIn > 1 ? 1 : sIn);
    const kIn = sInClamped * sInClamped * (3 - 2 * sInClamped);

    const sOut = (next - fadeOutStart) / Math.max(1e-6, (fadeOutEnd - fadeOutStart));
    const sOutClamped = sOut < 0 ? 0 : (sOut > 1 ? 1 : sOut);
    const kOut = sOutClamped * sOutClamped * (3 - 2 * sOutClamped);

    const kTrails = kIn * (1 - kOut) * this.trailOpacityScale;
    this.pointsMaterial.opacity = 0; // points are controlled per-bucket below
    for (const layer of this.trailLayers) {
      layer.mat.opacity = kTrails * layer.baseOpacity;
    }

    // Stars use per-bucket randomized offsets for both fade-in and fade-out
    for (const bucket of this.starBuckets) {
      const o = bucket.fadeOffset;
      const sInB = (next - (fadeInStart + o)) / Math.max(1e-6, (fadeInEnd - fadeInStart));
      const sInBClamped = sInB < 0 ? 0 : (sInB > 1 ? 1 : sInB);
      const kInB = sInBClamped * sInBClamped * (3 - 2 * sInBClamped);

      const sOutB = (next - (fadeOutStart + o)) / Math.max(1e-6, (fadeOutEnd - fadeOutStart));
      const sOutBClamped = sOutB < 0 ? 0 : (sOutB > 1 ? 1 : sOutB);
      const kOutB = sOutBClamped * sOutBClamped * (3 - 2 * sOutBClamped);

      bucket.material.opacity = kInB * (1 - kOutB);
    }

    // Update geometry-based trails and render
    this.updateStarPositions(next);
    this.renderer.render(this.scene, this.camera);
    this.currentProgress01 = next;
    this.lastRenderedProgress01 = next;
  }

  private startAnimation(): void {
    if (this.rafId) return;
    const loop = () => {
      if (this.isVisible) {
        this.animate();
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopAnimation(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private ensureRunning(): void {
    if (!this.rafId) {
      this.lastFrameTimeMs = performance.now();
      this.ngZone.runOutsideAngular(() => this.startAnimation());
    }
  }

  private requestRender(): void {
    this.lastRenderedProgress01 = -1;
    this.ensureRunning();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    this.isVisible = document.visibilityState === 'visible';
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
      this.ngZone.runOutsideAngular(() => {
        requestAnimationFrame(() => {
          this.resizeScheduled = false;
          const container = this.containerRef?.nativeElement;
          if (!container) {
            return;
          }
          const rect = container.getBoundingClientRect();
          const w = rect.width || window.innerWidth;
          const h = rect.height || window.innerHeight;
          this.camera.aspect = w / Math.max(h, 1);
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        });
      });
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    try {
      this.containerRef?.nativeElement?.removeChild(this.renderer.domElement);
    } catch {}
    this.renderer.dispose();
  }
}

