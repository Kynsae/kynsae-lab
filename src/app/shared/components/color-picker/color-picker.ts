import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

const EPS = 1e-6;

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const normalized = hex.startsWith('#') ? hex : '#' + hex;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (!result) return { h: 0, s: 0, v: 0 };
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const s = max < EPS ? 0 : d / max;
  const v = max;
  let h = 0;
  if (d >= EPS) {
    if (max - r < EPS) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max - g < EPS) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
    if (h < 0) h += 1;
    if (h >= 1) h -= 1;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToHex(h: number, s: number, v: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, (n + m) * 255))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

@Component({
  selector: 'app-color-picker',
  templateUrl: './color-picker.html',
  styleUrl: './color-picker.scss',
})
export class ColorPicker {
  readonly label = input<string>();
  readonly value = model<string>('#000000');

  protected readonly isOpen = signal(false);
  protected readonly hsv = computed(() => hexToHsv(this.value()));
  private readonly lastHue = signal(0);
  private readonly uiHsv = signal<{ h: number; s: number; v: number } | null>(null);

  private readonly effectiveHsv = computed(() => {
    const fromHex = this.hsv();
    const fromUi = this.uiHsv();
    const currentHex = this.value().toLowerCase();
    if (fromUi && hsvToHex(fromUi.h, fromUi.s, fromUi.v).toLowerCase() === currentHex) {
      return { h: fromUi.h, s: fromUi.s, v: fromUi.v };
    }
    const hasChroma = fromHex.s > EPS && fromHex.v > EPS;
    return {
      h: hasChroma ? fromHex.h : this.lastHue(),
      s: fromHex.s,
      v: fromHex.v,
    };
  });

  protected readonly pickerDotStyle = computed(() => {
    const { s, v } = this.effectiveHsv();
    return {
      left: s + '%',
      top: (100 - v) + '%',
    };
  });

  protected readonly hueDotStyle = computed(() => {
    const { h } = this.effectiveHsv();
    return { left: (h / 360) * 100 + '%' };
  });

  private readonly pickerRef = viewChild<ElementRef<HTMLCanvasElement>>('picker');
  private readonly hueRef = viewChild<ElementRef<HTMLCanvasElement>>('hue');
  private readonly hexInputRef = viewChild<ElementRef<HTMLInputElement>>('hexInput');
  private readonly isHexFocused = signal(false);

  constructor(private hostRef: ElementRef<HTMLElement>) {
    effect(() => {
      if (!this.isHexFocused() && this.hexInputRef()?.nativeElement) {
        this.hexInputRef()!.nativeElement.value = this.value();
      }
    });
    effect(() => {
      const { h, s, v } = this.effectiveHsv();
      if (s > EPS && v > EPS) {
        this.lastHue.set(h);
      }
    });
  }

  protected togglePicker(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      setTimeout(() => this.draw(), 0);
    }
  }

  protected closePicker(): void {
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const host = this.hostRef?.nativeElement;
    const target = event.target as Node | null;
    if (host && target && !host.contains(target)) {
      this.closePicker();
    }
  }

  protected onHexInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val) || /^[0-9a-fA-F]{6}$/.test(val)) {
      const hex = val.startsWith('#') ? val : '#' + val;
      this.value.set(hex);
      this.uiHsv.set(hexToHsv(hex));
    }
  }

  protected onHexFocus(event: Event): void {
    this.isHexFocused.set(true);
    (event.target as HTMLInputElement).select();
  }

  protected onHexBlur(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.trim();
    const normalized = val.startsWith('#') ? val : val ? '#' + val : this.value();
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      this.value.set(normalized);
      this.uiHsv.set(hexToHsv(normalized));
    } else {
      input.value = this.value();
    }
    this.isHexFocused.set(false);
  }

  protected onPickerClick(event: { offsetX: number; offsetY: number; target: EventTarget | null }): void {
    const canvas = this.pickerRef()?.nativeElement;
    if (!canvas || event.target !== canvas) return;
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;
    const canvasX = Math.min(canvas.width, Math.max(0, event.offsetX * scaleX));
    const canvasY = Math.min(canvas.height, Math.max(0, event.offsetY * scaleY));
    const x = canvasX / canvas.width;
    const y = canvasY / canvas.height;
    const { h: hue } = this.effectiveHsv();
    const s = x * 100;
    const v = (1 - y) * 100;
    const hex = hsvToHex(hue, s, v);
    this.value.set(hex);
    this.uiHsv.set({ h: hue, s, v });
    this.draw();
  }

  protected onHueClick(event: { offsetX: number; target: EventTarget | null }): void {
    const canvas = this.hueRef()?.nativeElement;
    if (!canvas || event.target !== canvas) return;
    const scaleX = canvas.width / canvas.offsetWidth;
    const canvasX = Math.min(canvas.width, Math.max(0, event.offsetX * scaleX));
    const x = canvasX / canvas.width;
    const h = x * 360;
    const { s, v } = this.effectiveHsv();
    const hex = hsvToHex(h, s, v);
    this.value.set(hex);
    this.uiHsv.set({ h, s, v });
    this.draw();
  }

  protected onPickerPointerDown(event: PointerEvent): void {
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    this.onPickerClick(event as unknown as MouseEvent);
    const move = (e: PointerEvent) => this.onPickerClick(e as unknown as MouseEvent);
    const up = () => {
      (event.target as Element).releasePointerCapture(event.pointerId);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  protected onHuePointerDown(event: PointerEvent): void {
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    this.onHueClick(event as unknown as MouseEvent);
    const move = (e: PointerEvent) => this.onHueClick(e as unknown as MouseEvent);
    const up = () => {
      (event.target as Element).releasePointerCapture(event.pointerId);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  private draw(): void {
    this.drawPicker();
    this.drawHue();
  }

  private drawPicker(): void {
    const canvas = this.pickerRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const { h } = this.effectiveHsv();
    const hueColor = hsvToHex(h, 100, 100);
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, hueColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, width, height);
  }

  private drawHue(): void {
    const canvas = this.hueRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 6; i++) {
      grad.addColorStop(i / 6, hsvToHex(i * 60, 100, 100));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }
}
