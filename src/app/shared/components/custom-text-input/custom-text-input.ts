import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-custom-text-input',
  imports: [],
  templateUrl: './custom-text-input.html',
  styleUrl: './custom-text-input.scss',
})
export class CustomTextInput {
  public icon = input<string>();
  public placeholder = input<string>();
  public value = model<string>('');

  public onInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.value.set(target?.value ?? '');
  }
}