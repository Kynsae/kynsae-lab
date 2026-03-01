import { Injectable } from '@angular/core';

@Injectable()
export class PlanetStyle {
  private readonly baseSize: number = 400;
  private readonly startOpacity: number = 20;
  private readonly endOpacity: number = 75;
  private readonly margin: number = 6;
  constructor() {}

  calculateScaleFactor(planetSize: number): number {
    return planetSize / this.baseSize;
  }

  updatePlanetShadow(percentage: number): { [key: string]: string } {
    const interpolatedOpacityStart = this.interpolate(this.startOpacity, 0, percentage);
    const interpolatedOpacityEnd = this.interpolate(this.endOpacity, 0, percentage);
    const interpolatedMargin = this.interpolate(this.margin, 0, percentage);

    return {
      'background': `linear-gradient(126deg, #00000000 ${interpolatedOpacityStart}%, #000000 ${interpolatedOpacityEnd}%)`,
      'margin-top': `${interpolatedMargin}%`,
      'margin-left': `${interpolatedMargin}%`,
    };
  }

  generateStyleVariables(params: {
    planetSize: number,
    mouseOffsetX: number,
    mouseOffsetY: number,
    primaryColor: string,
    secondaryColor: string,
    ringsColor: string,
    ringsDistance: string,
    movementIntensity: number,
    xRotation: number,
    yRotation: number
  }): Record<string, string> {
    const scaleFactor = this.calculateScaleFactor(params.planetSize);
    
    return {
      '--base-size': `${this.baseSize}px`,
      '--scale': `${scaleFactor}`,
      '--perspectiveX': `${params.xRotation + params.mouseOffsetX * params.movementIntensity}deg`,
      '--perspectiveY': `${params.yRotation - params.mouseOffsetY * params.movementIntensity}deg`,
      '--color-primary': params.primaryColor,
      '--color-secondary': params.secondaryColor,
      '--rings-color': params.ringsColor,
      '--rings-distance': params.ringsDistance,
      '--shader-transform': `translate(calc(-50% + ${params.mouseOffsetX * params.movementIntensity}%), calc(-50% + ${params.mouseOffsetY * params.movementIntensity}%))`
    };
  }

  private interpolate(start: number, end: number, progress: number): number {
    return start + (end - start) * (progress / 100);
  }
} 