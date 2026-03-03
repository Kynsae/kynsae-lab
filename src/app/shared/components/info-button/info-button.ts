import { Component, input } from '@angular/core';

@Component({
  selector: 'app-info-button',
  imports: [],
  templateUrl: './info-button.html',
  styleUrl: './info-button.scss',
})
export class InfoButton {
  public label = input<string>();
  public value = input<string>();
}
