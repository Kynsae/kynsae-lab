import type { ExperimentSetting } from './experiment-setting.model';

export interface Experiment {
    id: string;
    name: string;
    description: string;
    tags: string[];
    createdAt: Date;
    component: any;
    settings?: ExperimentSetting[];
}