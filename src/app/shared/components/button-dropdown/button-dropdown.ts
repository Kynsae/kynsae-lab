import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-button-dropdown',
  templateUrl: './button-dropdown.html',
  styleUrl: './button-dropdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ButtonDropdown {
  // INPUTS
  public text = input<string>();
  public icon = input<string>();
  public menus = input<string[]>();
  public multiSelect = input<boolean>(false);
  public position = input<'left' | 'right'>('left');

  // OUTPUTS
  public selected = output<string[]>();

  // SIGNALS
  public dropdownOpen = signal<boolean>(false);
  private selectedItems = signal<string[]>([]);

  // INJECTIONS
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  public toggleDropdown(): void {
    this.dropdownOpen.set(!this.dropdownOpen());
  }

  public selectMenu(menu: string): void {
    if(this.multiSelect()) {
      const current = this.selectedItems();
      const next = current.includes(menu)
        ? current.filter((m) => m !== menu)
        : [...current, menu];
      this.selectedItems.set(next);
      this.selected.emit(next);
    } else {
      this.selectedItems.set([menu]);
      this.selected.emit([menu]);
    }
  }

  public menuSelected(menu: string): boolean {
    return this.selectedItems().includes(menu);
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