import {
  Component,
  ElementRef,
  ViewChild,
  HostListener,
  AfterViewInit,
  OnDestroy,
  signal,
  inject,
  ChangeDetectorRef,
} from '@angular/core';

const SQUARE_SIZE = 20;
const SPACING = 50;
const CELL_SIZE = SQUARE_SIZE + SPACING;
/** Distance (px) at which attraction reaches 0; closer = brighter (white) */
const ATTRACTION_RADIUS = 200;
/** Trail decay per frame (0..1); higher = faster fade */
const TRAIL_DECAY = 0.9;
/** Ms without mouse move to consider idle; attraction only applies when moving */
const MOUSE_IDLE_MS = 80;

export interface GridCell {
  id: number;
  centerX: number;
  centerY: number;
}

@Component({
  selector: 'app-rotating-mirrors',
  imports: [],
  templateUrl: './rotating-mirrors.html',
  styleUrl: './rotating-mirrors.scss',
})
export class RotatingMirrors implements AfterViewInit, OnDestroy {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  @ViewChild('grid') gridRef!: ElementRef<HTMLElement>;

  readonly cells = signal<GridCell[]>([]);
  readonly cols = signal(0);
  readonly rows = signal(0);
  readonly mouseX = signal<number | null>(null);
  readonly mouseY = signal<number | null>(null);

  protected readonly cellSizePx = CELL_SIZE;

  private resizeObserver: ResizeObserver | null = null;
  /** Remnant trail 0..1 per cell (key: "centerX,centerY"); decays over time */
  private readonly trailByCell = new Map<string, number>();
  private decayAnimationId: number | null = null;
  private lastMouseMoveTime = 0;

  ngAfterViewInit(): void {
    const el = this.gridRef?.nativeElement;
    if (el) {
      this.resizeObserver = new ResizeObserver(() => this.buildGrid());
      this.resizeObserver.observe(el);
    }
    requestAnimationFrame(() => requestAnimationFrame(() => this.buildGrid()));
    this.startTrailDecay();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.decayAnimationId != null) cancelAnimationFrame(this.decayAnimationId);
  }

  private startTrailDecay(): void {
    const tick = (): void => {
      let hasTrail = false;
      this.trailByCell.forEach((v, key) => {
        const next = Math.max(0, v * TRAIL_DECAY);
        this.trailByCell.set(key, next);
        if (next > 0.005) hasTrail = true;
      });
      if (!hasTrail) {
        this.trailByCell.clear();
      }
      this.cdr.markForCheck();
      this.decayAnimationId = requestAnimationFrame(tick);
    };
    this.decayAnimationId = requestAnimationFrame(tick);
  }

  private buildGrid(): void {
    const el = this.gridRef?.nativeElement;
    if (!el) return;
    let { width, height } = el.getBoundingClientRect();
    // If grid hasn't been laid out yet (e.g. height 0), use host size as fallback
    if (!height || height < CELL_SIZE) {
      const hostRect = this.hostRef.nativeElement.getBoundingClientRect();
      height = hostRect.height;
    }
    if (!width || width < CELL_SIZE) {
      const hostRect = this.hostRef.nativeElement.getBoundingClientRect();
      width = hostRect.width;
    }
    const cols = Math.max(1, Math.ceil(width / CELL_SIZE));
    const rows = Math.max(1, Math.ceil(height / CELL_SIZE));
    this.cols.set(cols);
    this.rows.set(rows);
    const list: GridCell[] = [];
    let id = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        list.push({
          id: id++,
          centerX: col * CELL_SIZE + CELL_SIZE / 2,
          centerY: row * CELL_SIZE + CELL_SIZE / 2,
        });
      }
    }
    this.cells.set(list);
    this.trailByCell.clear();
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const el = this.gridRef?.nativeElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    this.mouseX.set(event.clientX - rect.left);
    this.mouseY.set(event.clientY - rect.top);
    this.lastMouseMoveTime = Date.now();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.mouseX.set(null);
    this.mouseY.set(null);
    this.lastMouseMoveTime = 0;
  }

  /** Attraction 0..1 from mouse to cell center (closer = higher). Only non-zero when mouse is moving. */
  getAttraction(cell: GridCell): number {
    const mx = this.mouseX();
    const my = this.mouseY();
    if (mx == null || my == null) return 0;
    if (Date.now() - this.lastMouseMoveTime > MOUSE_IDLE_MS) return 0;
    const dist = Math.hypot(mx - cell.centerX, my - cell.centerY) || 1;
    return Math.max(0, 1 - dist / ATTRACTION_RADIUS);
  }

  /** Background color from black to white based on attraction + trail (remnant). */
  getCellColor(cell: GridCell): string {
    const attraction = this.getAttraction(cell);
    const key = `${cell.centerX},${cell.centerY}`;
    const trail = this.trailByCell.get(key) ?? 0;
    const t = Math.max(attraction, trail);
    if (attraction > trail) {
      this.trailByCell.set(key, attraction);
    }
    const v = Math.round(255 * t);
    return `rgb(${v},${v},${v})`;
  }
}
