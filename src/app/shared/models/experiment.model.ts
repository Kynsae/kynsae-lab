import type { ExperimentSetting } from './experiment-setting.model';

export interface Experiment {
    id: string;
    name: string;
    description: string;
    tags: string[];
    year: string;
    component: any;
    settings?: ExperimentSetting[];
}