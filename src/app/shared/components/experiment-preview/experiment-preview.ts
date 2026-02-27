import { Component, input } from '@angular/core';
import { Experiment } from '../../models/experiment.model';

@Component({
  selector: 'app-experiment-preview',
  templateUrl: './experiment-preview.html',
  styleUrl: './experiment-preview.scss',
})
export class ExperimentPreview {
  public experiment = input<Experiment>();
}