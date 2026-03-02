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
   */
  public init(): void {
    this.lenis = new Lenis({
      autoRaf: true,
      lerp: .1,
      duration: 0.4,
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
}