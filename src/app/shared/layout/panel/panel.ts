import { Component, inject, signal } from '@angular/core';
import { ExperimentManager } from '../../../core/services/experiment-manager';
import { Experiment } from '../../models/experiment.model';
import { CustomTextInput } from '../../components/custom-text-input/custom-text-input';
import { ButtonDropdown } from '../../components/button-dropdown/button-dropdown';
import { ExperimentPreview } from '../../components/experiment-preview/experiment-preview';

@Component({
  selector: 'app-panel',
  imports: [
    CustomTextInput,
    ButtonDropdown,
    ExperimentPreview
  ],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel {
  private readonly experimentManager = inject(ExperimentManager);

  public experiments = signal<Experiment[]>([]);
  private readonly allExperiments: Experiment[] = [];

  constructor() {
    this.allExperiments = this.experimentManager.getAll();
    this.experiments.set(this.allExperiments);
  }

  public onSearchChange(term: string): void {
    const normalized = term.trim().toLowerCase();

    if (!normalized) {
      this.experiments.set(this.allExperiments);
      return;
    }

    this.experiments.set(
      this.allExperiments.filter((experiment) => {
        const haystacks = [
          experiment.name,
          experiment.description,
          experiment.id,
          ...experiment.tags,
        ].map((value) => value.toLowerCase());

        return haystacks.some((value) => value.includes(normalized));
      }),
    );
  }
}
