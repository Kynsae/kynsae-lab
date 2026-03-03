import { Component, effect, inject, signal } from '@angular/core';
import { ExperimentManager } from '../../../core/services/experiment-manager';
import { TextSearchService } from '../../../core/services/text-search.service';
import { Experiment } from '../../models/experiment.model';
import { CustomTextInput } from '../../components/custom-text-input/custom-text-input';
import { ButtonDropdown } from '../../components/button-dropdown/button-dropdown';
import { ExperimentPreview } from '../../components/experiment-preview/experiment-preview';
import { Button } from '../../components/button/button';
import { Slider } from '../../components/slider/slider';
import { Switch } from '../../components/switch/switch';
import { ColorPicker } from '../../components/color-picker/color-picker';
import { InfoButton } from '../../components/info-button/info-button';

@Component({
  selector: 'app-panel',
  imports: [
    CustomTextInput,
    ButtonDropdown,
    ExperimentPreview,
    Button,
    Slider,
    Switch,
    ColorPicker,
    InfoButton
  ],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  public readonly experimentManager = inject(ExperimentManager);
  private readonly textSearch = inject(TextSearchService);

  public experiments = signal<Experiment[]>([]);
  private readonly allExperiments: Experiment[] = [];
  public searching = signal<boolean>(false);
  public search = signal<string>('');
  public selectedTags = signal<string[]>([]);
  public currentSort = signal<string | null>(null);

  constructor() {
    this.allExperiments = this.experimentManager.getAll();
    this.experiments.set(this.allExperiments);
  }

  public readonly filterEffect = effect(() => {
    const term = this.search();
    const tags = this.selectedTags();
    const sort = this.currentSort();
    this.applyFilters(term, tags, sort);
  });

  private applyFilters(term: string, selectedTags: string[], sort: string | null): void {
    const hasSearch = this.textSearch.hasActiveSearch(term);
    const hasTagFilter = selectedTags.length > 0;

    let result = this.textSearch.search(this.allExperiments, term, (experiment) => [
      experiment.name,
      experiment.description,
      experiment.id,
      ...experiment.tags,
    ]);

    if (hasTagFilter) {
      const tagsToApply = selectedTags.filter((t) => t !== 'ALL');
      if (tagsToApply.length > 0) {
        const tagSet = new Set(tagsToApply.map((t) => t.toLowerCase()));
        result = result.filter((experiment) =>
          experiment.tags.some((t) => tagSet.has(t.toLowerCase()))
        );
      }
    }

    if (sort) {
      result = [...result].sort((a, b) => {
        switch (sort) {
          case 'RECENT':
            return b.createdAt.getTime() - a.createdAt.getTime();
          case 'OLDER':
            return a.createdAt.getTime() - b.createdAt.getTime();
          default:
            return 0;
        }
      });
    }

    this.searching.set(hasSearch);
    this.experiments.set(result);
  }

  public onTagsSelected(selected: string[]): void {
    this.selectedTags.set(selected);
  }

  public onSelected(selected: string[]): void {
    this.currentSort.set(selected.length > 0 ? selected[0] : null);
  }

  public clearSearch(): void {
    this.search.set('');
    this.selectedTags.set([]);
    this.currentSort.set(null);
    this.experiments.set(this.allExperiments);
    this.searching.set(false);
  }
}