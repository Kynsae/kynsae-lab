import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

const T = THREE as any;

@Injectable()
export class TorusEngineService {
  private readonly TORUS_RADIUS = 2;
  private readonly TORUS_TUBE = 0.3;
  private readonly TORUS_SEGMENTS = 32;
  private readonly TORUS_TUBE_SEGMENTS = 100;
  private readonly TORUS_MAJOR_SCALE = 0.95;

  private readonly INPUT_YAW_INVERT = 1;
  private readonly INPUT_PITCH_INVERT = 1;

  private PHYSICS_DAMPING = 0.985;
  private PHYSICS_IMPULSE_SCALE = 0.12;
  private readonly PHYSICS_MIN_VELOCITY = 0.0001;
  private PHYSICS_MAX_ANGULAR_SPEED = 0.03;
  private readonly PHYSICS_ACCELERATION = 0.1;
  private readonly PHYSICS_DECELERATION = 0.95;
  private PHYSICS_MOUSE_SENSITIVITY = 0.001;
  private PHYSICS_VELOCITY_SCALING = 0.1;
  private readonly COLLISION_SUBSTEP_MAX = 6;
  private readonly COLLISION_SUBSTEP_ANGLE = 0.01;

  private IDLE_ROTATION_SPEED_Z = 0.003;

  private isIntroPlaying = true;
  private introInitialized = false;
  private introStartTime = 0;
  private introDurationMs = 2000;
  private isFadingInCenterText = false;
  private fadeStartTime = 0;
  private fadeDurationMs = 900;
  private INTRO_TARGET_EULER = new T.Euler(10.5, -0.6, 0.0, 'XYZ');

  private scene = new T.Scene();
  private camera = new T.OrthographicCamera();
  private renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private rafId = 0;

  private torus!: any;
  private torusRadius = this.TORUS_RADIUS;
  private centerTextWorldBox?: any;
  private centerText?: any;

  private lastMouse = new T.Vector2();
  private isHovering = false;
  private mouseVelocity = new T.Vector2(0, 0);
  private angularVelocity = new T.Vector2(0, 0);
  private tmpVecA = new T.Vector3();
  private tmpVecB = new T.Vector3();
  private worldXAxis = new T.Vector3(1, 0, 0);
  private worldYAxis = new T.Vector3(0, 1, 0);
  private worldZAxis = new T.Vector3(0, 0, 1);
  private tmpQuatA = new T.Quaternion();
  private tmpQuatB = new T.Quaternion();
  private idleQuat = new T.Quaternion();
  private collisionCooldownUntil = 0;
  private introTargetQuat = new T.Quaternion();
  private introStartQuat = new T.Quaternion();
  private introInterpQuat = new T.Quaternion();
  private idleZAngle = 0;
  private baseRadius = this.TORUS_RADIUS * this.TORUS_MAJOR_SCALE;
  private radiusScale = 1;

  private INTRO_TURNS_X = 0.75;
  private INTRO_TURNS_Y = 1.5;
  private INTRO_WOBBLE_MAX_X = 0.9;
  private INTRO_WOBBLE_MAX_Y = 0.4;
  private bounceFactor = -0.8;
  private raycaster = new T.Raycaster();

  public init(containerEl: HTMLDivElement, resp: any): void {
    this.initScene(containerEl);

    this.torus.add(resp.mesh);
    this.baseRadius = resp.rCurve * this.TORUS_MAJOR_SCALE;
    this.updateTorusRadius(this.baseRadius * this.radiusScale);
    this.setCenterTextMesh(resp.centerMesh);

    this.resize(containerEl);
  }

  private initScene(containerEl: HTMLDivElement) {
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(Math.max(1, containerEl.clientWidth), Math.max(1, containerEl.clientHeight));
    containerEl.appendChild(this.renderer.domElement);
    this.camera.position.set(0, 0, 4);

    const geometry = new T.TorusGeometry(
      this.TORUS_RADIUS * this.TORUS_MAJOR_SCALE,
      this.TORUS_TUBE,
      this.TORUS_SEGMENTS,
      this.TORUS_TUBE_SEGMENTS
    );

    const material = new T.MeshPhysicalMaterial({
      roughness: 0,
      transmission: 2,
      thickness: 2.0,
      normalMap: new T.TextureLoader().load('experiments/006/normal.jpg'),
      normalScale: new T.Vector2(2, 0),
      envMapIntensity: 0.4
    });

    new HDRLoader().load('backdrop.hdr', (hdr: any) => {
      hdr.mapping = T.EquirectangularReflectionMapping;
      material.envMap = hdr;
    });

    this.torus = new T.Mesh(geometry, material);
    this.scene.add(this.torus);
  }

  start() {
    if (this.rafId) return;
    const loop = () => {
      this.updateFrame();
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  resize(containerEl: HTMLDivElement) {
    const w = Math.max(1, Math.floor(containerEl.clientWidth || containerEl.offsetWidth || 1));
    const h = Math.max(1, Math.floor(containerEl.clientHeight || containerEl.offsetHeight || 1));
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.left = -2 * aspect;
    this.camera.right = 2 * aspect;
    this.camera.top = 2;
    this.camera.bottom = -2;
    this.camera.updateProjectionMatrix();
  }

  dispose(containerEl?: HTMLDivElement) {
    this.stop();
    const dom = this.renderer.domElement;
    if (containerEl?.contains(dom)) containerEl.removeChild(dom);
    this.renderer.dispose();
    if (this.torus) {
      this.torus.geometry.dispose();
      this.torus.material.dispose();
    }
  }

  private setTorusThickness(thickness: number): void {
    this.torus.material.thickness = thickness;
  }

  public setRadiusScale(scale: number): void {
    this.radiusScale = scale;
    this.updateTorusRadius(this.baseRadius * this.radiusScale);
  }

  public setIntroDuration(ms: number): void {
    this.introDurationMs = ms;
  }

  public setFadeDuration(ms: number): void {
    this.fadeDurationMs = ms;
  }

  public setIdleRotationSpeedZ(speed: number): void {
    this.IDLE_ROTATION_SPEED_Z = speed;
  }

  public setPhysicsDamping(value: number): void {
    this.PHYSICS_DAMPING = value;
  }

  public setPhysicsImpulseScale(value: number): void {
    this.PHYSICS_IMPULSE_SCALE = value;
  }

  public setMouseSensitivity(value: number): void {
    this.PHYSICS_MOUSE_SENSITIVITY = value;
  }

  public setVelocityScaling(value: number): void {
    this.PHYSICS_VELOCITY_SCALING = value;
  }

  public setMaxAngularSpeed(value: number): void {
    this.PHYSICS_MAX_ANGULAR_SPEED = value;
  }

  public setIntroWobbleX(value: number): void {
    this.INTRO_WOBBLE_MAX_X = value;
  }

  public setIntroWobbleY(value: number): void {
    this.INTRO_WOBBLE_MAX_Y = value;
  }

  public setIntroTurnsX(value: number): void {
    this.INTRO_TURNS_X = value;
  }

  public setIntroTurnsY(value: number): void {
    this.INTRO_TURNS_Y = value;
  }

  public setBounceFactor(value: number): void {
    this.bounceFactor = value;
  }

  private setCenterTextMesh(mesh: any) {
    this.centerText = mesh;
    const material = mesh.material as any;
    if (material) {
      material.transparent = true;
      material.opacity = 0;
    }
    this.scene.add(mesh);
    this.setCenterTextWorldBoxFrom(mesh);
  }

  private setCenterTextOpacity(alpha: number) {
    if (!this.centerText) return;
    const material = this.centerText.material as any;
    if (!material) return;
    material.transparent = true;
    material.opacity = T.MathUtils.clamp(alpha, 0, 1);
    this.centerText.visible = material.opacity > 0.0001;
  }

  updateTorusRadius(newRadius: number) {
    if (!this.torus || Math.abs(newRadius - this.torusRadius) <= 1e-4) return;
    this.torus.geometry.dispose();
    this.torus.geometry = new T.TorusGeometry(newRadius, this.TORUS_TUBE, this.TORUS_SEGMENTS, this.TORUS_TUBE_SEGMENTS);
    this.torusRadius = newRadius;
  }

  private setCenterTextWorldBoxFrom(obj: any) {
    obj.updateMatrixWorld(true);
    this.centerTextWorldBox = new T.Box3().setFromObject(obj);
  }

  onPointerMove(ev: MouseEvent, containerEl: HTMLDivElement) {
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (inside) {
      const ndcX = (x / Math.max(1, rect.width)) * 2 - 1;
      const ndcY = -(y / Math.max(1, rect.height)) * 2 + 1;
      this.raycaster.setFromCamera({ x: ndcX, y: ndcY } as any, this.camera);
      const torus = this.torus;
      this.isHovering = !!torus && this.raycaster.intersectObject(torus, true).length > 0;
    } else {
      this.isHovering = false;
    }
    const dx = ev.clientX - this.lastMouse.x;
    const dy = ev.clientY - this.lastMouse.y;
      if (this.isHovering) {
        this.mouseVelocity.x = T.MathUtils.lerp(this.mouseVelocity.x, dx, this.PHYSICS_ACCELERATION);
        this.mouseVelocity.y = T.MathUtils.lerp(this.mouseVelocity.y, dy, this.PHYSICS_ACCELERATION);
      const mouseSensitivity = this.PHYSICS_IMPULSE_SCALE * this.PHYSICS_MOUSE_SENSITIVITY;
      const velocityMagnitude = this.mouseVelocity.length();
      const scaledSensitivity = mouseSensitivity * (1 + velocityMagnitude * this.PHYSICS_VELOCITY_SCALING);
      this.angularVelocity.x += this.mouseVelocity.y * scaledSensitivity * this.INPUT_PITCH_INVERT;
      this.angularVelocity.y += this.mouseVelocity.x * scaledSensitivity * this.INPUT_YAW_INVERT;
      this.clampAngularSpeed();
      this.mouseVelocity.multiplyScalar(this.PHYSICS_DECELERATION);
    } else {
      this.mouseVelocity.set(0, 0);
    }
    this.lastMouse.set(ev.clientX, ev.clientY);
  }

  private updateFrame() {
    const now = performance.now();
    this.idleZAngle += this.IDLE_ROTATION_SPEED_Z;
    const torus = this.torus;
    if (!torus) return;

    if (this.isIntroPlaying) {
      if (!this.introInitialized) {
        this.introInitialized = true;
        this.introStartTime = now;
        this.introTargetQuat.setFromEuler(this.INTRO_TARGET_EULER);
        torus.quaternion.identity();
        torus.updateMatrixWorld(true);
        this.introStartQuat.copy(torus.quaternion);
        this.angularVelocity.set(0, 0);
      }
      const t = Math.min(1, (now - this.introStartTime) / this.introDurationMs);
      const t2 = t * t;
      const t3 = t2 * t;
      const tSmoothQuintic = t3 * (t * (6 * t - 15) + 10);
      this.introInterpQuat.slerpQuaternions(this.introStartQuat, this.introTargetQuat, tSmoothQuintic);
      const wobbleEnvelope = Math.pow(1 - tSmoothQuintic, 1.5);
      const extraX = this.INTRO_WOBBLE_MAX_X * Math.sin((Math.PI * 2) * this.INTRO_TURNS_X * tSmoothQuintic) * wobbleEnvelope;
      const extraY = this.INTRO_WOBBLE_MAX_Y * Math.sin((Math.PI * 2) * this.INTRO_TURNS_Y * tSmoothQuintic + Math.PI) * wobbleEnvelope;
      this.tmpQuatA.setFromAxisAngle(this.worldXAxis, extraX);
      this.tmpQuatB.setFromAxisAngle(this.worldYAxis, extraY);
      torus.quaternion.copy(this.introInterpQuat);
      torus.quaternion.multiply(this.tmpQuatA);
      torus.quaternion.multiply(this.tmpQuatB);
      this.tmpQuatA.setFromAxisAngle(this.worldZAxis, this.idleZAngle);
      torus.quaternion.multiply(this.tmpQuatA);
      torus.updateMatrixWorld(true);

      const thickness = T.MathUtils.lerp(1.0, 0.3, tSmoothQuintic);
      this.setTorusThickness(thickness);

      if (!this.isFadingInCenterText && t >= 0.55) {
        this.isFadingInCenterText = true;
        this.fadeStartTime = now;
      }
      if (t >= 1) {
        this.tmpQuatA.setFromAxisAngle(this.worldZAxis, this.idleZAngle);
        torus.quaternion.copy(this.introTargetQuat);
        torus.quaternion.multiply(this.tmpQuatA);
        torus.updateMatrixWorld(true);
        this.isIntroPlaying = false;
        this.angularVelocity.set(0, 0);
        this.setTorusThickness(0.3);
      }
    } else {
      torus.rotateZ(this.IDLE_ROTATION_SPEED_Z);
      this.idleQuat.copy(torus.quaternion);
      const centerBox = this.centerTextWorldBox;
      const speed = this.angularVelocity.length();
      const substeps = Math.max(1, Math.min(this.COLLISION_SUBSTEP_MAX, Math.ceil(speed / Math.max(1e-8, this.COLLISION_SUBSTEP_ANGLE))));
      const stepX = this.angularVelocity.x / substeps;
      const stepY = this.angularVelocity.y / substeps;
      for (let i = 0; i < substeps; i++) {
        if (stepY !== 0) {
          this.tmpQuatA.setFromAxisAngle(this.worldYAxis, stepY);
          torus.quaternion.premultiply(this.tmpQuatA);
        }
        if (stepX !== 0) {
          this.tmpQuatB.setFromAxisAngle(this.worldXAxis, stepX);
          torus.quaternion.premultiply(this.tmpQuatB);
        }
        torus.updateMatrixWorld(true);
        if (centerBox && now >= this.collisionCooldownUntil && this.checkTorusCenterTextCollision(centerBox)) {
          const prevAx = this.angularVelocity.x;
          const prevAy = this.angularVelocity.y;
          this.applyBounceFromCollision(prevAx, prevAy, now);
          break;
        }
      }
    }

    if (!this.isIntroPlaying) {
      this.angularVelocity.multiplyScalar(this.PHYSICS_DAMPING);
      if (Math.abs(this.angularVelocity.x) < this.PHYSICS_MIN_VELOCITY) this.angularVelocity.x = 0;
      if (Math.abs(this.angularVelocity.y) < this.PHYSICS_MIN_VELOCITY) this.angularVelocity.y = 0;
      this.clampAngularSpeed();
    }

    if (this.isFadingInCenterText) {
      const ft = Math.min(1, (now - this.fadeStartTime) / this.fadeDurationMs);
      this.setCenterTextOpacity(ft);
      if (ft >= 1) this.isFadingInCenterText = false;
    }
  }

  private clampAngularSpeed() {
    const max = this.PHYSICS_MAX_ANGULAR_SPEED;
    const len = this.angularVelocity.length();
    if (len > max) this.angularVelocity.multiplyScalar(max / Math.max(1e-8, len));
  }

  private checkTorusCenterTextCollision(centerTextWorldBox: any): boolean {
    const torus = this.torus;
    const majorRadius = this.torusRadius;
    const tubeRadius = this.TORUS_TUBE;
    const samples = 64;
    const radiusWithMargin = tubeRadius + 0.006;
    for (let i = 0; i < samples; i++) {
      const theta = (i / samples) * Math.PI * 2;
      this.tmpVecA.set(Math.cos(theta) * majorRadius, Math.sin(theta) * majorRadius, 0);
      torus.localToWorld(this.tmpVecA);
      centerTextWorldBox.clampPoint(this.tmpVecA, this.tmpVecB);
      if (this.tmpVecA.distanceToSquared(this.tmpVecB) <= radiusWithMargin * radiusWithMargin) return true;
    }
    return false;
  }

  private applyBounceFromCollision(prevAx: number, prevAy: number, now: number) {
    if (!this.torus) return;
    this.torus.quaternion.copy(this.idleQuat);
    const nudge = 0.015;
    if (prevAy !== 0) {
      this.tmpQuatA.setFromAxisAngle(this.worldYAxis, -Math.sign(prevAy) * nudge);
      this.torus.quaternion.premultiply(this.tmpQuatA);
    }
    if (prevAx !== 0) {
      this.tmpQuatB.setFromAxisAngle(this.worldXAxis, -Math.sign(prevAx) * nudge);
      this.torus.quaternion.premultiply(this.tmpQuatB);
    }
    this.torus.updateMatrixWorld(true);
    this.angularVelocity.multiplyScalar(this.bounceFactor);
    this.clampAngularSpeed();
    this.collisionCooldownUntil = now + 180;
  }
}