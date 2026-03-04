import { ChangeDetectorRef, Component, Input, inject } from '@angular/core';

@Component({
  selector: 'app-image-experiment',
  imports: [],
  templateUrl: './image-experiment.html',
  styleUrl: './image-experiment.scss',
})
export class ImageExperiment {
  @Input() experimentId = '';

  private readonly cdr = inject(ChangeDetectorRef);

  targetX = 0;
  targetY = 0;
  displayX = 0;
  displayY = 0;

  readonly parallaxStrength = {
    background: 15,
    foreground: 45,
  };

  readonly lerpFactor = 0.05;

  private rafId: number | null = null;

  get imageSrc(): string {
    return this.experimentId ? `experiments/${this.experimentId}/${this.experimentId}.png` : '';
  }

  get backgroundTransform(): string {
    return `translate(${this.displayX * this.parallaxStrength.background}px, ${this.displayY * this.parallaxStrength.background}px)`;
  }

  get foregroundTransform(): string {
    return `translate(${this.displayX * this.parallaxStrength.foreground}px, ${this.displayY * this.parallaxStrength.foreground}px)`;
  }

  onMouseMove(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    this.targetX = (event.clientX - centerX) / (rect.width / 2);
    this.targetY = (event.clientY - centerY) / (rect.height / 2);

    this.tick();
  }

  onMouseLeave(): void {
    this.targetX = 0;
    this.targetY = 0;
    this.tick();
  }

  private tick(): void {
    if (this.rafId !== null) return;

    const animate = (): void => {
      this.displayX += (this.targetX - this.displayX) * this.lerpFactor;
      this.displayY += (this.targetY - this.displayY) * this.lerpFactor;
      this.cdr.detectChanges();

      const threshold = 0.001;
      if (
        Math.abs(this.targetX - this.displayX) > threshold ||
        Math.abs(this.targetY - this.displayY) > threshold
      ) {
        this.rafId = requestAnimationFrame(animate);
      } else {
        this.displayX = this.targetX;
        this.displayY = this.targetY;
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(animate);
  }
}
