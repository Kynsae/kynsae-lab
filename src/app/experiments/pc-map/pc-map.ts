import { Component, ElementRef, HostListener, inject, Input, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { CameraController } from './services/camera-controller';
import { ModelManager } from './services/model-manager';

@Component({
  selector: 'app-pc-map',
  imports: [CommonModule, FormsModule],
  templateUrl: 'pc-map.html',
  styleUrls: ['./pc-map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PCMap implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef;

  percentage = 0;
  clickRadius = 2.5;
  maxClickDuration = 2;
  clickStrength = 2.5;
  moveWindow = 0.3;
  centerRadius = 0.10;
  centerFalloff = 0.05;
  particleSize = 2.0;
  backgroundColor = '#000000';
  backgroundAlpha = 0;

  @Input() set progress(value: number) {
    if (value >= 0 && value <= 100) {
      this.percentage = value;
      this.applyPercentage();
    }
  }

  private scene = new THREE.Scene();
  private renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    powerPreference: 'high-performance',
    alpha: true
  });
  private rafId = 0;
  private resizeScheduled = false;
  private isVisible = true;
  
  private modelLoader = inject(ModelManager);
  private cameraController = inject(CameraController);
  private ngZone = inject(NgZone);

  private applyPercentage(): void {
    const progress = this.percentage / 100;
    this.modelLoader.update(progress);
    this.cameraController.update(progress);
  }

  protected onPercentageChange(): void {
    this.applyPercentage();
  }

  protected onSettingsChange(): void {
    this.modelLoader.updateSettings({
      clickRadius: this.clickRadius,
      maxClickDuration: this.maxClickDuration,
      clickStrength: this.clickStrength,
      moveWindow: this.moveWindow,
      centerRadius: this.centerRadius,
      centerFalloff: this.centerFalloff,
      pointSize: this.particleSize,
    });
  }

  protected onBackgroundChange(): void {
    const color = new THREE.Color(this.backgroundColor);
    this.renderer.setClearColor(color.getHex(), this.backgroundAlpha);
  }

  async ngOnInit(): Promise<void> {
    this.initScene();

    this.cameraController.init(this.scene, 'experiments/002/camera.glb');

    const center = await this.modelLoader.load(this.scene, 'experiments/002/map-model-day.ply', (progress) => {
      // console.log(`Progress: ${progress.toFixed(2)}%`);
    });
    
    this.ngZone.runOutsideAngular(() => this.startAnimation());
    this.onBackgroundChange();
  }

  private initScene(): void {
    this.renderer.setPixelRatio(Math.min(2, (window.devicePixelRatio || 1)));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0);

    (this.containerRef.nativeElement).appendChild(this.renderer.domElement);
    this.scene.background = null;
  }

  private animate = (): void => {
    this.modelLoader.tick();
    this.renderer.render(this.scene, this.cameraController.camera);
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

  @HostListener('window:resize')
  public onResize(): void {
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.resizeScheduled = false;
        this.cameraController.resizeCamera();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });
    });
  }

  @HostListener('click', ['$event'])
  public onClick(e: MouseEvent): void {
    if (e.target === this.renderer.domElement && this.percentage > 0) {
      this.modelLoader.onClick(e, this.cameraController.camera, this.renderer);
    }
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange() {
    this.isVisible = document.visibilityState === 'visible';
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    try {
      this.containerRef?.nativeElement?.removeChild(this.renderer.domElement);
    } catch {}
    this.renderer.dispose();
  }
}