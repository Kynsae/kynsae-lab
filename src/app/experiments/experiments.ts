import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgComponentOutlet } from '@angular/common';
import { ExperimentManager } from '../core/services/experiment-manager';
import { map } from 'rxjs';
import { ScrollManager } from '../core/services/scroll-manager';

@Component({
  selector: 'app-experiments',
  imports: [NgComponentOutlet],
  templateUrl: './experiments.html',
  styleUrl: './experiments.scss',
})
export class Experiments {
  private readonly route = inject(ActivatedRoute);
  private readonly experimentManager = inject(ExperimentManager);
  private readonly scrollManager = inject(ScrollManager);

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));

  readonly experimentComponent = computed(() => {
    const id = this.routeId();
    return (id ? this.experimentManager.getById(id) : undefined)?.component ?? null;
  });

  public lerp(
    rangeStart: number,
    rangeEnd: number,
    pageStart: number,
    pageEnd: number,
    currentScrollY: number
  ): number {
    const startY = this.scrollManager.limit() * (pageStart - 1);
    const endY = this.scrollManager.limit() * pageEnd;

    let t = (Math.max(startY, Math.min(currentScrollY, endY)) - startY) / (endY - startY);
    t = Math.max(0, Math.min(1, t));

    return rangeStart + t * (rangeEnd - rangeStart);
  }

  percentage() {
    return this.lerp(0, 100, 1, 2, this.scrollManager.actualScroll());
  }
}