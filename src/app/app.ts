import { AfterViewInit, Component, ElementRef, inject, OnInit, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
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
export class App implements AfterViewInit, OnInit {
  private readonly scrollManager = inject(ScrollManager);
  private readonly router = inject(Router);
  private readonly viewport = viewChild<ElementRef<HTMLElement>>('viewport');
  private readonly viewportContent = viewChild<ElementRef<HTMLElement>>('viewportContent');

  ngOnInit(): void {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.scrollManager.scrollToTop());
  }

  ngAfterViewInit(): void {
    const wrapper = this.viewport()?.nativeElement;
    const content = this.viewportContent()?.nativeElement;
    if (wrapper && content) {
      this.scrollManager.init(wrapper, content);
    }
  }
}