export interface Experiment {
    id: string;
    name: string;
    description: string;
    tags: string[];
    createdAt: Date;
    component: any;
}