import { Component, signal } from '@angular/core';
import { NebulaSplash } from './nebula-splash/nebula-splash';

@Component({
  selector: 'app-home',
  imports: [
    NebulaSplash
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
}
