import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

@Injectable({ providedIn: 'root' })
export class CameraController {
  public camera!: THREE.PerspectiveCamera;

  private mixer!: THREE.AnimationMixer;
  private action!: THREE.AnimationAction;
  private duration = 0;

  private loader = new GLTFLoader();

  public update(value: number): void {
    if (!this.action) return;
    this.action.time = value * this.duration;
    this.mixer.update(0);
  }

  public init(scene: THREE.Scene, path: string): void {
    this.loader.load(path, (gltf) => {
      this.camera = gltf.scene.getObjectByName('Camera') as THREE.PerspectiveCamera;
      this.resizeCamera();
      scene.add(this.camera);

      this.duration = Math.max(...gltf.animations.map(a => a.duration));
      this.mixer = new THREE.AnimationMixer(this.camera);
      (this.action = this.mixer.clipAction(gltf.animations[0])).play();
    });
  }

  public resizeCamera(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}