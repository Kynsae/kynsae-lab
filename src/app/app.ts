import { AfterViewInit, Component, ElementRef, inject, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/layout/navbar/navbar';
import { Panel } from './shared/layout/panel/panel';
import { Scrollbar } from './shared/components/scrollbar/scrollbar';
import { ScrollManager } from './core/services/scroll-manager';

@Component({
  selector: 'app-root',
  imports: [
    Panel,
    Navbar,
    Scrollbar,
    RouterOutlet
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit {
  private readonly scrollManager = inject(ScrollManager);
  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');

  ngAfterViewInit(): void {
    const el = this.viewport()?.nativeElement;
    if (el) {
      this.scrollManager.init(el);
    }
  }
}