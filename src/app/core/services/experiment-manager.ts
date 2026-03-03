import { Injectable, signal } from '@angular/core';
import { Experiment } from '../../shared/models/experiment.model';
import { EXPERIMENTS } from '../data/experiments.data';

@Injectable({
  providedIn: 'root',
})
export class ExperimentManager {

  public activeExperiment = signal<Experiment | null>(null);

  public getAll(): Experiment[] {
    return EXPERIMENTS;
  }

  public getByTag(tag: string): Experiment[] {
    return EXPERIMENTS.filter(experiment => experiment.tags.includes(tag));
  }

  public getById(id: string): Experiment | undefined {
    return EXPERIMENTS.find(experiment => experiment.id === id);
  }
}