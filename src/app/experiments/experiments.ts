import { Component, inject, computed, effect, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgComponentOutlet } from '@angular/common';
import { ExperimentManager } from '../core/services/experiment-manager';
import { ExperimentSettingsService } from '../core/services/experiment-settings.service';
import { map } from 'rxjs';
import { ScrollManager } from '../core/services/scroll-manager';
import { InfoPill } from '../shared/components/info-pill/info-pill';

const SETTING_TRANSFORMS: Record<string, (v: unknown) => unknown> = {
  ringsDistance: (v) => (typeof v === 'number' ? `${v}px` : v),
};

@Component({
  selector: 'app-experiments',
  imports: [
    NgComponentOutlet,
    InfoPill
  ],
  templateUrl: './experiments.html',
  styleUrl: './experiments.scss',
})
export class Experiments {
  private readonly route = inject(ActivatedRoute);
  private readonly experimentManager = inject(ExperimentManager);
  private readonly settingsService = inject(ExperimentSettingsService);
  private readonly scrollManager = inject(ScrollManager);

  readonly infoPillDismissed = signal(false);

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))));

  readonly activeExperiment = this.experimentManager.activeExperiment;

  readonly infoPillVisible = computed(() => {
    const experiment = this.activeExperiment();
    const dismissed = this.infoPillDismissed();
    return !!(experiment?.info && !dismissed);
  });

  readonly experimentComponent = computed(() => {
    const id = this.routeId();
    return (id ? this.experimentManager.getById(id) : undefined)?.component ?? null;
  });

  readonly experimentInputs = computed(() => {
    this.scrollManager.actualScroll(); // dependency for progress
    const settings = this.settingsService.settings();
    const base: Record<string, unknown> = {
      progress: this.percentage(),
      experimentId: this.activeExperiment()?.id ?? '',
    };

    for (const [key, value] of Object.entries(settings)) {
      const transform = SETTING_TRANSFORMS[key];
      base[key] = transform ? transform(value) : value;
    }
    return base;
  });

  constructor() {
    effect(() => {
      const id = this.routeId();
      const experiment = id ? this.experimentManager.getById(id) : undefined;
      this.experimentManager.activeExperiment.set(experiment ?? null);
      this.infoPillDismissed.set(false);
    });
  }

  onInfoPillClose(): void {
    this.infoPillDismissed.set(true);
  }

  public lerp(
    rangeStart: number,
    rangeEnd: number,
    pageStart: number,
    pageEnd: number,
    currentScrollY: number
  ): number {
    const startY = window.innerHeight * (pageStart - 1);
    const endY = window.innerHeight * pageEnd;

    let t = (Math.max(startY, Math.min(currentScrollY, endY)) - startY) / (endY - startY);
    t = Math.max(0, Math.min(1, t));

    return rangeStart + t * (rangeEnd - rangeStart);
  }

  percentage() {
    return this.lerp(0, 100, 1, 3, this.scrollManager.actualScroll());
  }
}