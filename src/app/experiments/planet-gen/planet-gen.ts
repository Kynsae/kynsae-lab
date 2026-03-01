import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, inject, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { WebGL } from './services/webgl';
import { PlanetStyle } from './services/planet-style';

@Component({
  selector: 'app-planet-gen',
  imports: [CommonModule],
  templateUrl: './planet-gen.html',
  styleUrl: './planet-gen.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PlanetStyle, WebGL]
})
export class PlanetGen implements OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() planetSize: number = 500;
  @Input() primaryColor: string = '#1c00ff';
  @Input() secondaryColor: string = '#00E0FF';
  @Input() hasRings: boolean = true;
  @Input() ringsColor: string = '#a3a9d781';
  @Input() ringsDistance: string = '400px';
  @Input() movementIntensity: number = .03;
  @Input() animationSpeed: number = .9;
  @Input() hasPerspective: boolean = true;
  @Input() hasAtmopshere: boolean = true;
  @Input() xRotation: number = 20;
  @Input() yRotation: number = 80;
  @Output() sceneReady = new EventEmitter<void>();
  
  @Input()
  set nightPercentage(value: number) {
    if (value < 0 || value > 100 || value === this._nightPercentage) {
      return;
    }
    this._nightPercentage = value;
    this.planetShadowStyles = this.planetStyleService.updatePlanetShadow(value);
    this.cdr.markForCheck();
  }
  get nightPercentage() {
    return this._nightPercentage;
  }
  mouseOffsetX: number = 0;
  mouseOffsetY: number = 0;
  private targetMouseOffsetX: number = 0;
  private targetMouseOffsetY: number = 0;
  private rafId: number | null = null;
  private readonly smoothingFactor: number = 0.1;
  private _nightPercentage: number = 0;
  private resizeObserver: ResizeObserver | null = null;

  private readonly webglService = inject(WebGL);
  private readonly planetStyleService = inject(PlanetStyle);
  private readonly cdr = inject(ChangeDetectorRef);
  planetShadowStyles: { [key: string]: string } = this.planetStyleService.updatePlanetShadow(this._nightPercentage);

  ngAfterViewInit() { 
    this.initWebGL(); 
    this.startSmoothingLoop();
  }

  ngOnDestroy() {
    if (this.canvasRef?.nativeElement) {
      this.webglService.cleanup(this.canvasRef.nativeElement);
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private async initWebGL(): Promise<void> {
    if (!this.hasAtmopshere) {
      this.sceneReady.emit();
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    await this.webglService.initialize(canvas);
    this.webglService.animate(canvas);
    this.resizeObserver ??= new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
    this.sceneReady.emit();
  }

  private handleResize() {
    if (this.canvasRef?.nativeElement) {
      this.webglService.resize(this.canvasRef.nativeElement);
    }
  }

  public updatePlanetShadow(percentage: number): { [key: string]: string } {
    return this.planetStyleService.updatePlanetShadow(percentage);
  }

  public generateStyleVariables(): Record<string, string> {
    return this.planetStyleService.generateStyleVariables({
      planetSize: this.planetSize,
      mouseOffsetX: this.mouseOffsetX,
      mouseOffsetY: this.mouseOffsetY,
      primaryColor: this.primaryColor,
      secondaryColor: this.secondaryColor,
      ringsColor: this.ringsColor,
      ringsDistance: this.ringsDistance,
      movementIntensity: this.movementIntensity,
      xRotation: this.xRotation,
      yRotation: this.yRotation
    });
  }

  private updateMouseOffsets(event: MouseEvent): void {
    this.targetMouseOffsetX = ((event.clientX - window.innerWidth / 2) / (window.innerWidth / 2)) * 100;
    this.targetMouseOffsetY = ((event.clientY - window.innerHeight / 2) / (window.innerHeight / 2)) * 100;
  }

  private startSmoothingLoop(): void {
    const step = () => {
      const deltaX = this.targetMouseOffsetX - this.mouseOffsetX;
      const deltaY = this.targetMouseOffsetY - this.mouseOffsetY;
      
      this.mouseOffsetX += deltaX * this.smoothingFactor;
      this.mouseOffsetY += deltaY * this.smoothingFactor;
      
      // Check if we're close enough to the target (within 0.1 units)
      const threshold = 0.1;
      if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) {
        // Set exact target values and stop the loop
        this.mouseOffsetX = this.targetMouseOffsetX;
        this.mouseOffsetY = this.targetMouseOffsetY;
        this.rafId = null;
        this.cdr.detectChanges();
        return;
      }
      
      this.cdr.detectChanges();
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMoveEvent(event: MouseEvent): void {
    if (this.hasPerspective) {
      this.updateMouseOffsets(event);
      // Restart the smoothing loop if it's not already running
      if (this.rafId === null) {
        this.startSmoothingLoop();
      }
    }
  }
}
