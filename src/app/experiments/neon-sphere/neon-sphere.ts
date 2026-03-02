import { Component, ElementRef, HostListener, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';

type ConnectorMeta = {
  geometry: THREE.BufferGeometry;
  tValues: Float32Array;
  jitterA: Float32Array;
  jitterB: Float32Array;
  spacing: number;
  maxSteps: number;
};

@Component({
  selector: 'app-neon-sphere',
  imports: [],
  templateUrl: './neon-sphere.html',
  styleUrl: './neon-sphere.scss'
})
export class NeonSphere implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private readonly sceneRadius = 1.3;
  private readonly sliceCount = 70;
  private readonly sliceSegments = 10020;
  private readonly sliceThickness = 0.01;
  private readonly radialThickness = 0.01;
  private readonly sliceColor = 0x3E17FF;
  private readonly slicePointSize = 1.0;
  private readonly maxRightOffsetX = 5.0;
  private readonly maxRightOffsetY = 4.0;
  private readonly cutOffsetRange = 0.3;
  private readonly cutOffsetMaxRatio = 0.9;
  private readonly groupRotation = new THREE.Euler(
    THREE.MathUtils.degToRad(-40),
    THREE.MathUtils.degToRad(0),
    THREE.MathUtils.degToRad(-20)
  );
  private readonly cameraPosition = new THREE.Vector3(0, 0.4, 3.2);

  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  private slicesGroup = new THREE.Group();
  private resizeScheduled = false;
  private clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private tmpVec3 = new THREE.Vector3();
  private tmpRight = new THREE.Vector3();
  private tmpUp = new THREE.Vector3();
  private tmpOffsetWorld = new THREE.Vector3();
  private tmpOffsetLocal = new THREE.Vector3();
  private tmpCenterOffset = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpInvQuat = new THREE.Quaternion();
  private tmpCutNormal = new THREE.Vector3();
  private tmpEdgeA = new THREE.Vector3();
  private tmpEdgeB = new THREE.Vector3();
  private tmpEdgeLocal = new THREE.Vector3();
  private readonly clippingOffset = 0.3;
  private readonly orthoSize = 2.1;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private rightSliceGroups: THREE.Group[] = [];
  private connectorMetas: ConnectorMeta[] = [];
  private currentRightOffsetX = 0;
  private currentRightOffsetY = 0;
  private percentage = 1;
  private isReady = false;

  @Input() public set offsetPercentage(value: number) {
    this.percentage = Math.min(1, Math.max(0, value));
    this.updateCurrentOffsets();
    if (this.isReady) {
      this.updateOffsetTransforms();
    }
  }

  constructor(private ngZone: NgZone) {}

  ngOnInit(): void {
    this.initScene();
    this.updateCurrentOffsets();
    this.createSliceSphere();
    this.isReady = true;
    this.updateOffsetTransforms();
    this.renderFrame();
  }

  private initScene(): void {
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.localClippingEnabled = true;
    this.scene.add(this.slicesGroup);
    this.camera.position.copy(this.cameraPosition);
    this.camera.lookAt(0, 0, 0);

    this.containerRef.nativeElement.appendChild(this.renderer.domElement);
    this.resizeRenderer();
  }

  private createSliceSphere(): void {
    this.rightSliceGroups = [];
    this.connectorMetas = [];
    const material = new THREE.PointsMaterial({
      color: this.sliceColor,
      size: this.slicePointSize,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending
    });
    material.clippingPlanes = [this.clippingPlane];
    this.materials.push(material);

    this.tmpQuat.setFromEuler(this.groupRotation);
    this.tmpInvQuat.copy(this.tmpQuat).invert();
    const cutNormal = this.tmpCutNormal.set(1, 0, 0).applyQuaternion(this.tmpInvQuat);
    this.slicesGroup.rotation.copy(this.groupRotation);
    const offsetWorld = this.getOffsetWorld(this.tmpOffsetWorld);
    const offsetLocal = this.getOffsetLocal(this.tmpOffsetLocal, offsetWorld);

    const invSliceCount = 1 / this.sliceCount;
    for (let i = 0; i <= this.sliceCount; i += 1) {
      const t = i * invSliceCount;
      const theta = t * Math.PI;
      const y = Math.cos(theta) * this.sceneRadius;
      const sliceRadius = Math.sin(theta) * this.sceneRadius;
      if (sliceRadius <= 0.01) continue;
      const rawCutOffset = (Math.random() - 0.5) * this.cutOffsetRange;
      const cutLimit = sliceRadius * this.cutOffsetMaxRatio;
      const cutOffset = THREE.MathUtils.clamp(rawCutOffset, -cutLimit, cutLimit);

      const { leftPoints, rightPoints } = this.createCirclePoints(
        sliceRadius,
        this.sliceSegments,
        this.sliceThickness,
        this.radialThickness,
        y,
        cutOffset,
        cutNormal,
        material
      );
      const sliceGroup = new THREE.Group();
      sliceGroup.position.y = y;
      sliceGroup.add(leftPoints);

      const rightGroup = new THREE.Group();
      rightGroup.position.copy(offsetLocal);
      rightGroup.add(rightPoints);
      sliceGroup.add(rightGroup);
      this.rightSliceGroups.push(rightGroup);

      const edgeCount = this.getCutEdgePoints(
        sliceRadius,
        y,
        cutOffset,
        cutNormal,
        this.tmpEdgeA,
        this.tmpEdgeB
      );
      for (let e = 0; e < edgeCount; e += 1) {
        const base = e === 0 ? this.tmpEdgeA : this.tmpEdgeB;
        const baseLocal = this.tmpEdgeLocal.set(base.x, 0, base.z);
        const connector = this.createConnectorPoints(
          offsetLocal,
          sliceRadius,
          this.sliceSegments,
          this.sliceThickness,
          this.radialThickness,
          material
        );
        const connectorGroup = new THREE.Group();
        connectorGroup.position.copy(baseLocal);
        connectorGroup.add(connector);
        sliceGroup.add(connectorGroup);
      }

      this.slicesGroup.add(sliceGroup);
    }

    this.slicesGroup.position.copy(this.getCenterOffsetWorld(this.tmpCenterOffset, offsetWorld));
  }

  private createCirclePoints(
    radius: number,
    segments: number,
    thickness: number,
    radialThickness: number,
    sliceY: number,
    cutOffset: number,
    cutNormal: THREE.Vector3,
    material: THREE.Material
  ): { leftPoints: THREE.Points; rightPoints: THREE.Points } {
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radiusJitter = (Math.random() - 0.5) * radialThickness;
      const baseX = Math.cos(angle) * (radius + radiusJitter);
      const baseZ = Math.sin(angle) * (radius + radiusJitter);
      const cutValue = cutNormal.x * baseX + cutNormal.y * sliceY + cutNormal.z * baseZ;
      const y = (Math.random() - 0.5) * thickness;
      const target = cutValue > cutOffset ? right : left;
      target.push(baseX, y, baseZ);
    }
    const leftGeometry = new THREE.BufferGeometry();
    leftGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(left), 3));
    this.geometries.push(leftGeometry);
    const rightGeometry = new THREE.BufferGeometry();
    rightGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(right), 3));
    this.geometries.push(rightGeometry);
    return {
      leftPoints: new THREE.Points(leftGeometry, material),
      rightPoints: new THREE.Points(rightGeometry, material)
    };
  }

  private updateCurrentOffsets(): void {
    this.currentRightOffsetX = this.maxRightOffsetX * this.percentage;
    this.currentRightOffsetY = this.maxRightOffsetY * this.percentage;
  }

  private updateOffsetTransforms(): void {
    const offsetWorld = this.getOffsetWorld(this.tmpOffsetWorld);
    const offsetLocal = this.getOffsetLocal(this.tmpOffsetLocal, offsetWorld);
    for (const group of this.rightSliceGroups) {
      group.position.copy(offsetLocal);
    }
    for (const meta of this.connectorMetas) {
      this.updateConnectorGeometry(
        meta.geometry,
        meta.tValues,
        meta.jitterA,
        meta.jitterB,
        meta.spacing,
        meta.maxSteps,
        offsetLocal
      );
    }
    this.slicesGroup.position.copy(this.getCenterOffsetWorld(this.tmpCenterOffset, offsetWorld));
    this.renderFrame();
  }

  private createConnectorPoints(
    offsetLocal: THREE.Vector3,
    sliceRadius: number,
    segments: number,
    thickness: number,
    radialThickness: number,
    material: THREE.PointsMaterial
  ): THREE.Points {
    const circumference = Math.max(1e-4, 2 * Math.PI * sliceRadius);
    const spacing = circumference / Math.max(1, segments);
    const maxLength = Math.hypot(this.maxRightOffsetX, this.maxRightOffsetY);
    const length = Math.max(1e-4, maxLength);
    const steps = Math.max(2, Math.round(length / spacing));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(steps * 3), 3));
    this.geometries.push(geometry);

    const jitterRadius = Math.max(thickness, radialThickness);
    const tValues = new Float32Array(steps);
    const jitterA = new Float32Array(steps);
    const jitterB = new Float32Array(steps);
    for (let i = 0; i < steps; i += 1) {
      tValues[i] = Math.random();
      jitterA[i] = (Math.random() - 0.5) * jitterRadius;
      jitterB[i] = (Math.random() - 0.5) * jitterRadius;
    }
    if (steps > 0) {
      tValues[0] = 0;
      jitterA[0] = 0;
      jitterB[0] = 0;
    }
    if (steps > 1) {
      const last = steps - 1;
      tValues[last] = 1;
      jitterA[last] = 0;
      jitterB[last] = 0;
    }

    this.connectorMetas.push({ geometry, tValues, jitterA, jitterB, spacing, maxSteps: steps });
    this.updateConnectorGeometry(
      geometry,
      tValues,
      jitterA,
      jitterB,
      spacing,
      steps,
      offsetLocal
    );

    return new THREE.Points(geometry, material);
  }

  private updateConnectorGeometry(
    geometry: THREE.BufferGeometry,
    tValues: Float32Array,
    jitterA: Float32Array,
    jitterB: Float32Array,
    spacing: number,
    maxSteps: number,
    offsetVec: THREE.Vector3
  ): void {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = positions.array as Float32Array;
    const length = offsetVec.length();
    const activeSteps = Math.max(2, Math.min(maxSteps, Math.round(length / Math.max(1e-6, spacing))));
    let dirX = 1;
    let dirY = 0;
    let dirZ = 0;
    if (length > 1e-6) {
      dirX = offsetVec.x / length;
      dirY = offsetVec.y / length;
      dirZ = offsetVec.z / length;
    }
    const basisAx = Math.abs(dirY) < 0.99 ? 0 : 1;
    const basisAy = Math.abs(dirY) < 0.99 ? 1 : 0;
    const basisAz = 0;
    let sideX = dirY * basisAz - dirZ * basisAy;
    let sideY = dirZ * basisAx - dirX * basisAz;
    let sideZ = dirX * basisAy - dirY * basisAx;
    const sideLen = Math.hypot(sideX, sideY, sideZ) || 1;
    sideX /= sideLen;
    sideY /= sideLen;
    sideZ /= sideLen;
    const upX = sideY * dirZ - sideZ * dirY;
    const upY = sideZ * dirX - sideX * dirZ;
    const upZ = sideX * dirY - sideY * dirX;
    for (let i = 0; i < tValues.length; i += 1) {
      const t = tValues[i];
      const idx = i * 3;
      if (i < activeSteps) {
        const baseScale = t * length;
        const jA = jitterA[i];
        const jB = jitterB[i];
        array[idx] = dirX * baseScale + sideX * jA + upX * jB;
        array[idx + 1] = dirY * baseScale + sideY * jA + upY * jB;
        array[idx + 2] = dirZ * baseScale + sideZ * jA + upZ * jB;
      } else {
        array[idx] = offsetVec.x;
        array[idx + 1] = offsetVec.y;
        array[idx + 2] = offsetVec.z;
      }
    }
    positions.needsUpdate = true;
  }

  private getOffsetWorld(out: THREE.Vector3): THREE.Vector3 {
    this.tmpRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.tmpUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    out.copy(this.tmpRight).multiplyScalar(this.currentRightOffsetX);
    out.add(this.tmpUp.multiplyScalar(this.currentRightOffsetY));
    return out;
  }

  private getOffsetLocal(out: THREE.Vector3, offsetWorld: THREE.Vector3): THREE.Vector3 {
    this.tmpInvQuat.copy(this.slicesGroup.quaternion).invert();
    out.copy(offsetWorld).applyQuaternion(this.tmpInvQuat);
    return out;
  }

  private getCenterOffsetWorld(out: THREE.Vector3, offsetWorld: THREE.Vector3): THREE.Vector3 {
    out.copy(offsetWorld).multiplyScalar(-0.5);
    return out;
  }

  private getCutEdgePoints(
    radius: number,
    y: number,
    cutOffset: number,
    cutNormal: THREE.Vector3,
    outA: THREE.Vector3,
    outB: THREE.Vector3
  ): number {
    const a = cutNormal.x;
    const b = cutNormal.z;
    const d = cutOffset - cutNormal.y * y;
    const denom = a * a + b * b;
    if (denom < 1e-6) {
      return 0;
    }

    const distSq = (d * d) / denom;
    const radiusSq = radius * radius;
    if (distSq > radiusSq) {
      return 0;
    }

    const x0 = (a * d) / denom;
    const z0 = (b * d) / denom;
    const h = Math.sqrt(Math.max(radiusSq - distSq, 0));
    const invLen = 1 / Math.sqrt(denom);
    const dx = -b * invLen;
    const dz = a * invLen;

    outA.set(x0 + dx * h, y, z0 + dz * h);
    outB.set(x0 - dx * h, y, z0 - dz * h);
    return 2;
  }

  private renderFrame(): void {
    const normal = this.camera.getWorldDirection(this.tmpVec3).negate();
    const planePoint = this.scene.position.clone().addScaledVector(normal, -this.clippingOffset);
    this.clippingPlane.setFromNormalAndCoplanarPoint(normal, planePoint);
    this.renderer.render(this.scene, this.camera);
  }

  private resizeRenderer(): void {
    const rect = this.containerRef.nativeElement.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const aspect = width / height;
    this.camera.left = -this.orthoSize * aspect;
    this.camera.right = this.orthoSize * aspect;
    this.camera.top = this.orthoSize;
    this.camera.bottom = -this.orthoSize;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  @HostListener('window:resize')
  public onResize(): void {
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.resizeScheduled = false;
        this.resizeRenderer();
        this.renderFrame();
      });
    });
  }

  ngOnDestroy(): void {
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.renderer.dispose();
    try {
      this.containerRef?.nativeElement?.removeChild(this.renderer.domElement);
    } catch {}
  }
}
