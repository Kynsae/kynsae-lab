import { Component, ElementRef, HostListener, inject, Input, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { CameraController } from './services/camera-controller';
import { ModelManager } from './services/model-manager';

@Component({
  selector: 'app-pc-map',
  imports: [CommonModule],
  templateUrl: 'pc-map.html',
  styleUrls: ['./pc-map.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PCMap implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef;

  percentage = 0;
  private _isDayMode = true;
  private _clickRadius = 2.5;
  private _maxClickDuration = 2;
  private _clickStrength = 2.5;
  private _moveWindow = 0.3;
  private _centerRadius = 0.10;
  private _centerFalloff = 0.05;
  private _particleSize = 2.0;
  private _backgroundColor = '#373f49';
  private _backgroundAlpha = 1;

  get isDayMode() { return this._isDayMode; }
  get clickRadius() { return this._clickRadius; }
  get maxClickDuration() { return this._maxClickDuration; }
  get clickStrength() { return this._clickStrength; }
  get moveWindow() { return this._moveWindow; }
  get centerRadius() { return this._centerRadius; }
  get centerFalloff() { return this._centerFalloff; }
  get particleSize() { return this._particleSize; }
  get backgroundColor() { return this._backgroundColor; }
  get backgroundAlpha() { return this._backgroundAlpha; }

  @Input() set isDayMode(v: boolean) {
    if (this._isDayMode !== v) {
      this._isDayMode = v;
      this.onModeChange();
    }
  }
  @Input() set clickRadius(v: number) {
    if (this._clickRadius !== v) { this._clickRadius = v; this.onSettingsChange(); }
  }
  @Input() set maxClickDuration(v: number) {
    if (this._maxClickDuration !== v) { this._maxClickDuration = v; this.onSettingsChange(); }
  }
  @Input() set clickStrength(v: number) {
    if (this._clickStrength !== v) { this._clickStrength = v; this.onSettingsChange(); }
  }
  @Input() set moveWindow(v: number) {
    if (this._moveWindow !== v) { this._moveWindow = v; this.onSettingsChange(); }
  }
  @Input() set centerRadius(v: number) {
    if (this._centerRadius !== v) { this._centerRadius = v; this.onSettingsChange(); }
  }
  @Input() set centerFalloff(v: number) {
    if (this._centerFalloff !== v) { this._centerFalloff = v; this.onSettingsChange(); }
  }
  @Input() set particleSize(v: number) {
    if (this._particleSize !== v) { this._particleSize = v; this.onSettingsChange(); }
  }
  @Input() set backgroundColor(v: string) {
    if (this._backgroundColor !== v) { this._backgroundColor = v; this.onBackgroundChange(); }
  }
  @Input() set backgroundAlpha(v: number) {
    if (this._backgroundAlpha !== v) { this._backgroundAlpha = v; this.onBackgroundChange(); }
  }

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

  protected onSettingsChange(): void {
    this.modelLoader.updateSettings({
      clickRadius: this._clickRadius,
      maxClickDuration: this._maxClickDuration,
      clickStrength: this._clickStrength,
      moveWindow: this._moveWindow,
      centerRadius: this._centerRadius,
      centerFalloff: this._centerFalloff,
      pointSize: this._particleSize,
    });
  }

  protected async onModeChange(): Promise<void> {
    this._backgroundColor = this._isDayMode ? '#373f49' : '#000000';
    this.onBackgroundChange();
    const path = this._isDayMode ? 'experiments/002/map-model-day.ply' : 'experiments/002/map-model-night.ply';
    await this.modelLoader.load(this.scene, path, () => {});
    this.applyPercentage();
    this.onSettingsChange();
  }

  private async loadModel(): Promise<THREE.Vector3> {
    const path = this._isDayMode ? 'experiments/002/map-model-day.ply' : 'experiments/002/map-model-night.ply';
    return this.modelLoader.load(this.scene, path, () => {});
  }

  protected onBackgroundChange(): void {
    const color = new THREE.Color(this._backgroundColor);
    this.renderer.setClearColor(color.getHex(), this._backgroundAlpha);
  }

  async ngOnInit(): Promise<void> {
    this.initScene();

    this.cameraController.init(this.scene, 'experiments/002/camera.glb');

    const center = await this.loadModel();
    
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