import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Button } from '../button/button';

@Component({
  selector: 'app-switch',
  imports: [
    Button
  ],
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Switch {
  public label = input<string>();
  public value = model<boolean>(false);
}
