import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ExperimentManager } from '../../../core/services/experiment-manager';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navbar {

  private readonly router = inject(Router);
  private readonly experimentManager = inject(ExperimentManager);

  public navigateToHome(): void {
    this.experimentManager.activeExperiment.set(null);
    this.router.navigate(['/']);
  }
}