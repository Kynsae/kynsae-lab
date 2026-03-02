import { PLYLoader } from 'three-stdlib';
import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root'
})
export class ModelManager {
  private loader = new PLYLoader();
  private points!: THREE.Points;
  private pointsRaycast?: THREE.Points; // decimated point cloud for fast picking
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private raycastHits: THREE.Intersection[] = [];
  private clickWriteIndex = 0;
  private clickCount = 0;
  private readonly baseRotation = new THREE.Euler(THREE.MathUtils.degToRad(-90), 0, 0);
  private readonly inverseRotationQuat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(THREE.MathUtils.degToRad(90), 0, 0)
  );
  private pendingClickX: number | null = null;
  private pendingClickY: number | null = null;
  private pendingCamera?: THREE.PerspectiveCamera;
  private tmpVec3 = new THREE.Vector3();

  private uniforms = {
    uGlobalTime: { value: 0 },
    uClickPos: { value: Array.from({ length: 20 }, () => new THREE.Vector3(9999, 9999, 9999)) },
    uClickTime: { value: Array.from({ length: 20 }, () => -1e6) },
    uIntroCenter: { value: new THREE.Vector3(0,0,0) },
    uMaxDistance: { value: 0 },
    uProgress: { value: 0.0 },
    uClickCount: { value: 0 },
    uClickRadius: { value: 2.5 },
    uMaxClickDuration: { value: 2.0 },
    uClickStrength: { value: 2.5 },
    uMoveWindow: { value: 0.3 },
    uCenterRadius: { value: 0.10 },
    uCenterFalloff: { value: 0.05 },
    uPointSize: { value: 2.0 },
  };

  constructor() {
    this.raycaster.params.Points = { threshold: 0.1 };
  }

  private async loadShader(url: string): Promise<string> {
    return (await fetch(url)).text();
  }

  public async load(scene: THREE.Scene, modelPath: string, onProgress: (progress: number) => void): Promise<THREE.Vector3> {
    return new Promise((resolve) => {
      this.loader.load(modelPath,
        async (geometry) => {
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();

          // Keep original bounding sphere center intact; compute intro center separately
          const bsCenter = geometry.boundingSphere!.center;
          const introCenter = bsCenter.clone().add(new THREE.Vector3(-0.1, 1.2, -1.5));
          this.uniforms.uIntroCenter.value.copy(introCenter);

          const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
          const arr = positionAttr.array as Float32Array;
          let maxDistance = 0;
          // Compute max distance relative to introCenter without vector allocations
          const cx = introCenter.x, cy = introCenter.y, cz = introCenter.z;
          for (let i = 0; i < arr.length; i += 3) {
            const dx = arr[i] - cx;
            const dy = arr[i + 1] - cy;
            const dz = arr[i + 2] - cz;
            const dist = Math.hypot(dx, dy, dz);
            if (dist > maxDistance) maxDistance = dist;
          }

          this.uniforms.uMaxDistance.value = maxDistance;
          // Share the same underlying array for originalPosition to avoid duplication
          geometry.setAttribute('originalPosition', new THREE.BufferAttribute(arr, 3));

          const [vertexShader, fragmentShader] = await Promise.all([
            this.loadShader('experiments/002/pc-map-vertex.glsl'),
            this.loadShader('experiments/002/pc-map-fragment.glsl')
          ]);

          this.points = new THREE.Points(
            geometry,
            new THREE.ShaderMaterial({
              vertexShader,
              fragmentShader,
              uniforms: this.uniforms,
              transparent: true,
              vertexColors: true
            })
          );

          this.points.rotation.copy(this.baseRotation);
          scene.add(this.points);

          // Build a decimated geometry used only for raycasting to avoid heavy CPU work
          try {
            const totalVertices = positionAttr.count;
            const targetVertices = Math.min(50000, totalVertices); // cap to ~50k for picking
            const stride = Math.max(1, Math.floor(totalVertices / targetVertices));

            const decimatedLength = Math.ceil(totalVertices / stride) * 3;
            const decimatedPositions = new Float32Array(decimatedLength);
            let writeIndex = 0;
            for (let i = 0; i < totalVertices; i += stride) {
              const srcIdx = i * 3;
              decimatedPositions[writeIndex++] = arr[srcIdx];
              decimatedPositions[writeIndex++] = arr[srcIdx + 1];
              decimatedPositions[writeIndex++] = arr[srcIdx + 2];
            }

            const pickGeometry = new THREE.BufferGeometry();
            pickGeometry.setAttribute('position', new THREE.BufferAttribute(decimatedPositions, 3));
            // Copy bounds to keep early-out checks efficient
            pickGeometry.boundingSphere = geometry.boundingSphere?.clone() || null;
            pickGeometry.boundingBox = geometry.boundingBox?.clone() || null;

            // Material is irrelevant for raycasting; keep minimal
            const pickPoints = new THREE.Points(pickGeometry, new THREE.PointsMaterial({ size: 1 }));
            pickPoints.visible = false; // never rendered
            pickPoints.frustumCulled = false; // ensure it's always considered for picking

            // Attach as a child so it inherits all transforms from the rendered points
            this.points.add(pickPoints);
            this.pointsRaycast = pickPoints;
          } catch (_) {
            // If anything goes wrong, fall back to full geometry for picking
            this.pointsRaycast = this.points;
          }
          resolve(introCenter.clone().applyEuler(this.baseRotation));
        },
        (progress) => {
          onProgress((progress.loaded / progress.total) * 100)
        }
      );
    });
  }

  public update(value: number) {
    this.uniforms.uProgress.value = value;
  }

  public updateSettings(settings: {
    clickRadius?: number;
    maxClickDuration?: number;
    clickStrength?: number;
    moveWindow?: number;
    centerRadius?: number;
    centerFalloff?: number;
    pointSize?: number;
  }) {
    if (settings.clickRadius !== undefined) this.uniforms.uClickRadius.value = settings.clickRadius;
    if (settings.maxClickDuration !== undefined) this.uniforms.uMaxClickDuration.value = settings.maxClickDuration;
    if (settings.clickStrength !== undefined) this.uniforms.uClickStrength.value = settings.clickStrength;
    if (settings.moveWindow !== undefined) this.uniforms.uMoveWindow.value = settings.moveWindow;
    if (settings.centerRadius !== undefined) this.uniforms.uCenterRadius.value = settings.centerRadius;
    if (settings.centerFalloff !== undefined) this.uniforms.uCenterFalloff.value = settings.centerFalloff;
    if (settings.pointSize !== undefined) this.uniforms.uPointSize.value = settings.pointSize;
  }

  public tick() {
    this.uniforms.uGlobalTime.value = performance.now() / 1000;

    // Process deferred click in the render loop to avoid blocking the click event
    if (!this.points?.geometry || this.pendingClickX === null || this.pendingClickY === null || !this.pendingCamera) return;
    // Reuse mouse vector to avoid allocations
    this.mouse.set(this.pendingClickX, this.pendingClickY);
    this.raycaster.setFromCamera(this.mouse, this.pendingCamera);
    this.raycastHits.length = 0;
    const targetForRaycast = this.pointsRaycast || this.points;
    // No need to recurse; we raycast a single Points object
    this.raycaster.intersectObject(targetForRaycast, false, this.raycastHits);

    const intersect = this.raycastHits[0];
    if (intersect) {
      const worldPoint = this.tmpVec3.copy(intersect.point).applyQuaternion(this.inverseRotationQuat);

      this.uniforms.uClickPos.value[this.clickWriteIndex].copy(worldPoint);
      this.uniforms.uClickTime.value[this.clickWriteIndex] = performance.now() * 0.001;

      this.clickWriteIndex = (this.clickWriteIndex + 1) % this.uniforms.uClickPos.value.length;
      this.clickCount = Math.min(this.clickCount + 1, this.uniforms.uClickPos.value.length);
      this.uniforms.uClickCount.value = this.clickCount;
    }

    // Clear pending click after processing
    this.pendingClickX = null;
    this.pendingClickY = null;
    this.pendingCamera = undefined;
  }

  public onClick(event: MouseEvent, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer): void {
    const rect = renderer.domElement.getBoundingClientRect();

    // Defer raycasting to the render loop to avoid a click-induced hitch
    this.pendingClickX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pendingClickY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.pendingCamera = camera;
  }
}