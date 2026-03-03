import {
  Component,
  computed,
  ElementRef,
  HostListener,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-slider',
  imports: [DecimalPipe],
  templateUrl: './slider.html',
  styleUrl: './slider.scss'
})
export class Slider {
  readonly label = input<string>();
  readonly min = input<number>(0);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  readonly value = model<number>(0);

  private readonly trackRef = viewChild<ElementRef<HTMLElement>>('track');
  protected readonly isDragging = signal(false);

  protected readonly percentage = computed(() => {
    const [min, max, val] = [this.min(), this.max(), this.value()];
    return max === min ? 0 : Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
  });

  @HostListener('document:pointermove', ['$event'])
  protected onPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) return;
    this.updateValueFromEvent(event);
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  protected onPointerUp(): void {
    this.isDragging.set(false);
  }

  protected onPointerDown(event: PointerEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
    this.updateValueFromEvent(event);
  }

  private updateValueFromEvent(event: PointerEvent): void {
    const track = this.trackRef()?.nativeElement;
    if (!track) return;

    const { left, width } = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (event.clientX - left) / width));
    const [min, max, step] = [this.min(), this.max(), this.step()];
    const raw = min + pct * (max - min);
    const stepped = Math.round(raw / step) * step;
    this.value.set(Math.min(max, Math.max(min, stepped)));
  }
}
