import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-custom-text-input',
  imports: [],
  templateUrl: './custom-text-input.html',
  styleUrl: './custom-text-input.scss',
})
export class CustomTextInput {
  public icon = input<string>();
  public placeholder = input<string>();
  public valueChange = output<string>();

  public onInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.valueChange.emit(target?.value ?? '');
  }
}