import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  imports: [],
  templateUrl: './button.html',
  styleUrl: './button.scss',
  host: {
    '[class.full-width]': 'fullWidth()',
  },
})
export class Button {
  public image = input<string>();
  public fullWidth = input<boolean>(false);
}
