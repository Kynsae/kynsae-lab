import {
  Component,
  ElementRef,
  HostListener,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-button-dropdown',
  imports: [],
  templateUrl: './button-dropdown.html',
  styleUrl: './button-dropdown.scss',
})
export class ButtonDropdown {
  public text = input<string>();
  public icon = input<string>();
  public menus = input<string[]>();
  public multiSelect = input<boolean>(false);
  public position = input<'left' | 'right'>('left');

  public selectedMenu = output<string>();

  public dropdownOpen = signal<boolean>(false);

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  public toggleDropdown() {
    this.dropdownOpen.set(!this.dropdownOpen());
  }

  public selectMenu(menu: string) {
    this.selectedMenu.emit(menu);

    if (!this.multiSelect()) {
      this.dropdownOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (
      this.dropdownOpen() &&
      !this.elementRef.nativeElement.contains(event.target as Node)
    ) {
      this.dropdownOpen.set(false);
    }
  }
}