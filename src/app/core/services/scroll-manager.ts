import { Injectable, signal } from '@angular/core';
import Lenis from 'lenis';

/**
 * Manages scroll position: Lenis on desktop, native scroll events on mobile.
 * Provides reactive actualScroll and limit.
 */
@Injectable({
  providedIn: 'root'
})
export class ScrollManager {
  private lenis: Lenis | null = null;
  public readonly actualScroll = signal(0);
  public readonly limit = signal(0);

  /** 
   * Initializes scroll: Lenis on desktop, native scroll listener on mobile.
   * Pass wrapper (scroll container) and content (its direct child) when the document doesn't scroll.
   */
  public init(wrapper?: HTMLElement, content?: HTMLElement): void {
    const w = wrapper ?? window;
    const c = content ?? (wrapper ? (wrapper.firstElementChild as HTMLElement) ?? wrapper : document.documentElement);
    this.lenis = new Lenis({
      wrapper: w,
      content: c,
      autoRaf: true,
      lerp: .1,
      duration: 0.9,
    });

    this.lenis.on('scroll', () => {
      this.actualScroll.set(this.lenis!.animatedScroll);
      this.limit.set(this.lenis!.limit);
    });
  }

  /** 
   * Pauses smooth scrolling (e.g., during page transitions). No-op on mobile. 
   */
  public stop(): void {
    this.lenis?.stop();
  }

  /** 
   * Resumes smooth scrolling after being stopped. No-op on mobile. 
   */
  public start(): void {
    this.lenis?.start();
  }

  /** 
   * Scrolls to top. Use on route change to reset scroll position. 
   */
  public scrollToTop(): void {
    this.lenis?.scrollTo(0, { immediate: true });
  }

  /** 
   * Scrolls to a specific position. 
   */
  public scrollTo(y: number, immediate = false): void {
    this.lenis?.scrollTo(y, { immediate });
  }
}