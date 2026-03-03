import { computed, inject, Injectable, signal } from '@angular/core';
import { ExperimentManager } from './experiment-manager';
import type { ExperimentSetting } from '../../shared/models/experiment-setting.model';

export type SettingsValues = Record<string, number | boolean | string>;

@Injectable({ providedIn: 'root' })
export class ExperimentSettingsService {
  private readonly experimentManager = inject(ExperimentManager);

  /** Per-experiment settings state */
  private readonly settingsMap = signal<Record<string, SettingsValues>>({});

  /** Active experiment's settings (reactive) */
  readonly settings = computed(() => {
    const active = this.experimentManager.activeExperiment();
    const map = this.settingsMap();
    if (!active?.id) return {};
    return map[active.id] ?? {};
  });

  /** Initialize settings from schema when experiment becomes active */
  initialize(experimentId: string, definitions: ExperimentSetting[]): void {
    const map = { ...this.settingsMap() };
    const existing = map[experimentId];
    if (existing) return;

    const defaults = Object.fromEntries(definitions.map((d) => [d.key, d.defaultValue]));
    map[experimentId] = defaults;
    this.settingsMap.set(map);
  }

  setSetting(key: string, value: number | boolean | string): void {
    const active = this.experimentManager.activeExperiment();
    if (!active?.id) return;

    const map = { ...this.settingsMap() };
    const current = map[active.id] ?? {};
    map[active.id] = { ...current, [key]: value };
    this.settingsMap.set(map);
  }
}
