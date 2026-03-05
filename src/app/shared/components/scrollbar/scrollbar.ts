import {
  Component,
  inject,
  effect,
  ElementRef,
  ChangeDetectionStrategy,
  viewChild,
  input,
} from '@angular/core';
import { ScrollManager } from '../../../core/services/scroll-manager';
import { fromEvent } from 'rxjs';
import { auditTime } from 'rxjs/operators';

const HIDE_DELAY_MS = 500;
const HANDLE_HEIGHT_PX = 200;

@Component({
  selector: 'app-scrollbar',
  templateUrl: './scrollbar.html',
  styleUrl: './scrollbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Scrollbar {
  private readonly scrollManager = inject(ScrollManager);

  private readonly containerRef = viewChild<ElementRef<HTMLElement>>('container');
  private readonly trackRef = viewChild<ElementRef<HTMLElement>>('track');
  private readonly handleRef = viewChild<ElementRef<HTMLElement>>('handle');

  /** Optional scroll container. When set, tracks this element instead of the global ScrollManager. */
  readonly scrollTarget = input<ElementRef<HTMLElement> | HTMLElement | null>(null);

  private hideTimeout = 0;
  private visible = false;
  private scrollTop = 0;
  private scrollHeight = 0;
  private clientHeight = 0;
  private trackHeight = 0;

  constructor() {
    effect((onCleanup) => {
      const target = this.scrollTarget();
      const container = this.containerRef()?.nativeElement;
      const track = this.trackRef()?.nativeElement;
      const handle = this.handleRef()?.nativeElement;

      if (!container || !track || !handle) return;

      const el = this.resolveElement(target);

      if (el) {
        const cleanup = this.setupContainerScroll(el, container, track, handle);
        onCleanup(cleanup);
      } else {
        container.classList.remove('mode-relative');
        this.updateFromGlobalScroll(container, track, handle);
      }
    });
  }

  private resolveElement(
    target: ElementRef<HTMLElement> | HTMLElement | null
  ): HTMLElement | null {
    if (!target) return null;
    return target instanceof HTMLElement ? target : target.nativeElement;
  }

  private setupContainerScroll(
    el: HTMLElement,
    container: HTMLElement,
    track: HTMLElement,
    handle: HTMLElement
  ): () => void {
    container.classList.add('mode-relative');

    const update = () => {
      this.scrollTop = el.scrollTop;
      this.scrollHeight = el.scrollHeight;
      this.clientHeight = el.clientHeight;
      this.trackHeight = track.clientHeight;
      this.applyPosition(handle, track);
      this.show(container);
    };

    const sub = fromEvent(el, 'scroll', { passive: true })
      .pipe(auditTime(16))
      .subscribe(update);

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    ro.observe(track);

    update();

    return () => {
      sub.unsubscribe();
      ro.disconnect();
    };
  }

  private updateFromGlobalScroll(
    container: HTMLElement,
    track: HTMLElement,
    handle: HTMLElement
  ): void {
    const scroll = this.scrollManager.actualScroll();
    const limit = this.scrollManager.limit();
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

    this.scrollTop = scroll;
    this.scrollHeight = limit + vh;
    this.clientHeight = vh;
    this.trackHeight = vh;

    this.applyPosition(handle, track);
    this.show(container);
  }

  private applyPosition(handle: HTMLElement, track: HTMLElement): void {
    const limit = this.scrollHeight - this.clientHeight;
    if (limit <= 0) {
      handle.style.display = 'none';
      return;
    }
    handle.style.display = '';

    const progress = Math.min(1, Math.max(0, this.scrollTop / limit));
    const trackH = this.trackHeight;
    const handleH = HANDLE_HEIGHT_PX;
    const range = trackH - handleH;
    const top = range > 0 ? progress * range : 0;

    handle.style.transform = `translate3d(0,${top}px,0)`;
  }

  private show(container: HTMLElement): void {
    if (!this.visible) {
      this.visible = true;
      container.classList.add('visible');
    }
    clearTimeout(this.hideTimeout);
    this.hideTimeout = window.setTimeout(() => {
      this.visible = false;
      container.classList.remove('visible');
    }, HIDE_DELAY_MS);
  }

}
