import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Experiment } from '../../models/experiment.model';

@Component({
  selector: 'app-experiment-preview',
  imports: [RouterLink],
  templateUrl: './experiment-preview.html',
  styleUrl: './experiment-preview.scss',
})
export class ExperimentPreview {
  public experiment = input<Experiment>();
}