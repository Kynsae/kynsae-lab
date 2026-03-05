import { Component, ElementRef, HostListener, Input, inject, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TorusEngineService } from './services/torus-engine.service';
import { TorusTextService } from './services/torus-text.service';

@Component({
  selector: 'app-torus',
  imports: [],
  templateUrl: './torus.html',
  styleUrl: './torus.scss',
  providers: [TorusEngineService, TorusTextService]
})
export class Torus implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  private readonly TORUS_TEXT = "THIS IS A VERY LONG TEXT";
  private readonly CENTER_TEXT = "TORUS EFFECT";
  private readonly CUSTOM_FONT_PATH = 'experiments/006/gothic.ttf';

  @Input() set radiusScale(value: number) {
    this.engine.setRadiusScale(value);
  }

  @Input() set introDurationMs(value: number) {
    this.engine.setIntroDuration(value);
  }

  @Input() set fadeDurationMs(value: number) {
    this.engine.setFadeDuration(value);
  }

  @Input() set idleRotationSpeedZ(value: number) {
    this.engine.setIdleRotationSpeedZ(value);
  }

  @Input() set physicsDamping(value: number) {
    this.engine.setPhysicsDamping(value);
  }

  @Input() set physicsImpulseScale(value: number) {
    this.engine.setPhysicsImpulseScale(value);
  }

  @Input() set mouseSensitivity(value: number) {
    this.engine.setMouseSensitivity(value);
  }

  @Input() set velocityScaling(value: number) {
    this.engine.setVelocityScaling(value);
  }

  @Input() set maxAngularSpeed(value: number) {
    this.engine.setMaxAngularSpeed(value);
  }

  @Input() set introWobbleX(value: number) {
    this.engine.setIntroWobbleX(value);
  }

  @Input() set introWobbleY(value: number) {
    this.engine.setIntroWobbleY(value);
  }

  @Input() set introTurnsX(value: number) {
    this.engine.setIntroTurnsX(value);
  }

  @Input() set introTurnsY(value: number) {
    this.engine.setIntroTurnsY(value);
  }

  @Input() set bounceFactor(value: number) {
    this.engine.setBounceFactor(value);
  }

  private ngZone = inject(NgZone);
  private engine = inject(TorusEngineService);
  private textManager = inject(TorusTextService);

  async ngOnInit() {
    const resp = await this.textManager.init(this.CUSTOM_FONT_PATH, this.TORUS_TEXT, this.CENTER_TEXT);
    
    this.engine.init(this.containerRef.nativeElement, resp);

    this.ngZone.runOutsideAngular(() => this.engine.start());
  }

  ngOnDestroy(): void {
    this.engine.dispose(this.containerRef?.nativeElement);
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.engine.resize(this.containerRef.nativeElement);
  }

  @HostListener('window:mousemove', ['$event'])
  onPointerMove(ev: MouseEvent) {
    this.engine.onPointerMove(ev, this.containerRef.nativeElement);
  }

  @HostListener('window:mousedown')
  onClick() {
    this.textManager.cycleTextColor();
  }
}