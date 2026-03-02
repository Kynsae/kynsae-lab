import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/layout/navbar/navbar';
import { Panel } from './shared/layout/panel/panel';
import { ScrollManager } from './core/services/scroll-manager';

@Component({
  selector: 'app-root',
  imports: [
    Panel,
    Navbar,
    RouterOutlet
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('kynsae-lab');

  private readonly scrollManager = inject(ScrollManager);

  constructor() {
    this.scrollManager.init();
  }
}