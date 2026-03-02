import { MagicBall } from "../../experiments/magic-ball/magic-ball";
import { NeonSphere } from "../../experiments/neon-sphere/neon-sphere";
import { PCMap } from "../../experiments/pc-map/pc-map";
import { PlanetGen } from "../../experiments/planet-gen/planet-gen";
import { Experiment } from "../../shared/models/experiment.model";

export const EXPERIMENTS: Experiment[] = [
    {
        id: '001',
        name: 'CSS Planet Generator',
        description: 'Procedural planet with atmosphere and rings.',
        tags: ['ART', 'WEBGL'],
        createdAt: new Date(),
        component: PlanetGen,
    },
    {
        id: '002',
        name: 'Geneva Point Cloud',
        description: 'Procedural planet with atmosphere and rings.',
        tags: ['ART', 'WEBGL'],
        createdAt: new Date(),
        component: PCMap,
    },
    {
        id: '003',
        name: 'Point Cloud',
        description: 'Point cloud visualization.',
        tags: ['ART', 'WEBGL'],
        createdAt: new Date(),
        component: MagicBall,
    },
    {
        id: '004',
        name: 'Slicing',
        description: '.',
        tags: ['ART', 'WEBGL'],
        createdAt: new Date(),
        component: NeonSphere,
    },
];