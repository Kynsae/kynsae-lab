import { Routes } from '@angular/router';
import { Experiments } from './experiments/experiments';
import { Home } from './experiments/home/home';

export const routes: Routes = [
    {
        path: '',
        component: Home
    },
    {
        path: ':id',
        component: Experiments
    },
];
