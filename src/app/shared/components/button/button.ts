import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  templateUrl: './button.html',
  styleUrl: './button.scss',
  host: {
    '[class.full-width]': 'fullWidth()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  public image = input<string>();
  public fullWidth = input<boolean>(false);
  public active = input<boolean>(false);
}
