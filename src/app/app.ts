import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/layout/navbar/navbar';
import { Panel } from './shared/layout/panel/panel';

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
}
