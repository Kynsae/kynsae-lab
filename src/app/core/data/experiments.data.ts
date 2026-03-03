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
        year: '2024',
        component: PlanetGen,
        settings: [
            { type: 'slider', key: 'nightPercentage', label: 'Night Percentage', min: 0, max: 100, step: 1, defaultValue: 0 },
            { type: 'switch', key: 'hasRings', label: 'Show Rings', defaultValue: true },
            { type: 'color', key: 'primaryColor', label: 'Planet Color', defaultValue: '#1c00ff' },
            { type: 'color', key: 'secondaryColor', label: 'Atmosphere Color', defaultValue: '#00E0FF' },
            { type: 'color', key: 'ringsColor', label: 'Rings Color', defaultValue: '#a3a9d781' },
            { type: 'slider', key: 'ringsDistance', label: 'Rings Distance', min: 0, max: 800, step: 10, defaultValue: 400 },
            { type: 'slider', key: 'movementIntensity', label: 'Movement Intensity', min: 0, max: 0.2, step: 0.01, defaultValue: 0.03 },
            { type: 'slider', key: 'xRotation', label: 'X Rotation', min: -180, max: 180, step: 1, defaultValue: 20 },
            { type: 'slider', key: 'yRotation', label: 'Y Rotation', min: -180, max: 180, step: 1, defaultValue: 80 },
            { type: 'switch', key: 'hasPerspective', label: 'Perspective', defaultValue: true },
            { type: 'switch', key: 'hasAtmopshere', label: 'Atmosphere', defaultValue: true },
        ],
    },
    {
        id: '002',
        name: 'Geneva Point Cloud',
        description: 'Procedural planet with atmosphere and rings.',
        tags: ['ART', 'WEBGL'],
        year: '2024',
        component: PCMap,
        settings: [
            { type: 'switch', key: 'isDayMode', label: 'Day Mode', defaultValue: true },
            { type: 'slider', key: 'clickRadius', label: 'Click Radius', min: 0.5, max: 5, step: 0.1, defaultValue: 2.5 },
            { type: 'slider', key: 'maxClickDuration', label: 'Max Click Duration', min: 0.5, max: 5, step: 0.1, defaultValue: 2 },
            { type: 'slider', key: 'clickStrength', label: 'Click Strength', min: 0.5, max: 5, step: 0.1, defaultValue: 2.5 },
            { type: 'slider', key: 'moveWindow', label: 'Move Window', min: 0.1, max: 0.6, step: 0.01, defaultValue: 0.3 },
            { type: 'slider', key: 'centerRadius', label: 'Center Radius', min: 0.02, max: 0.3, step: 0.01, defaultValue: 0.10 },
            { type: 'slider', key: 'centerFalloff', label: 'Center Falloff', min: 0.01, max: 0.15, step: 0.01, defaultValue: 0.05 },
            { type: 'slider', key: 'particleSize', label: 'Particle Size', min: 0.5, max: 4, step: 0.1, defaultValue: 3 },
            { type: 'color', key: 'backgroundColor', label: 'Background Color', defaultValue: '#373f49' },
            { type: 'slider', key: 'backgroundAlpha', label: 'Background Alpha', min: 0, max: 1, step: 0.05, defaultValue: 1 },
        ],
    },
    {
        id: '003',
        name: 'Point Cloud',
        description: 'Point cloud visualization.',
        tags: ['ART', 'WEBGL'],
        year: '2024',
        component: MagicBall,
    },
    {
        id: '004',
        name: 'Slicing',
        description: '.',
        tags: ['ART', 'WEBGL'],
        year: '2024',
        component: NeonSphere,
    },
];