import { Component } from '@angular/core';
import { RotatingMirrors } from '../../shared/components/rotating-mirrors/rotating-mirrors';

@Component({
  selector: 'app-home',
  imports: [
    RotatingMirrors
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {

}
