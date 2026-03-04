import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-info-pill',
  templateUrl: './info-pill.html',
  styleUrl: './info-pill.scss',
})
export class InfoPill {
  public visible = input<boolean>(false);
  public experimentId = input<string>();
  public content = input<string>();
  public closeClicked = output<void>();
}
