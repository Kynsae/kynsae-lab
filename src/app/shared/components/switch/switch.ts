import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-switch',
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
})
export class Switch {
  public label = input<string>();
  public value = model<boolean>(false);
}
