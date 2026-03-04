import { Component, ElementRef, HostListener, inject, Input, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-magic-ball',
  imports: [],
  templateUrl: './magic-ball.html',
  styleUrl: './magic-ball.scss'
})
export class MagicBall implements OnInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private particleSystem!: THREE.Points;
  private animationId!: number;
  private targetRotationX = 0;
  private targetRotationY = 0;
  private currentRotationX = 0;
  private currentRotationY = 0;

  // Live-adjustable params (from settings panel)
  private _perspectiveCamera = false;
  private _sizeMultiplier = 1;
  private _color = '#5100FF';
  private _rotationAmplitude = Math.PI / 3;
  private _particleCount = 300000;
  private _radius = 4;
  private _layerCount = 10;
  private _layerSpacing = 1.1;
  private _minSliceRadius = 0.1;
  private _particleSize = 4;

  @Input() set perspectiveCamera(v: boolean) {
    if (this._perspectiveCamera !== v) {
      this._perspectiveCamera = v;
      this.recreateCamera();
    }
  }
  @Input() set sizeMultiplier(v: number) {
    if (this._sizeMultiplier !== v) {
      this._sizeMultiplier = v;
      this.updateUniforms();
    }
  }
  @Input() set color(v: string) {
    if (this._color !== v) {
      this._color = v;
      this.updateUniforms();
    }
  }
  @Input() set rotationAmplitude(v: number) {
    this._rotationAmplitude = (v * Math.PI) / 180;
  }
  @Input() set particleCount(v: number) {
    if (this._particleCount !== v) {
      this._particleCount = v;
      this.rebuildParticlePlanet();
    }
  }
  @Input() set radius(v: number) {
    if (this._radius !== v) {
      this._radius = v;
      this.rebuildParticlePlanet();
    }
  }
  @Input() set layerCount(v: number) {
    if (this._layerCount !== v) {
      this._layerCount = v;
      this.rebuildParticlePlanet();
    }
  }
  @Input() set layerSpacing(v: number) {
    if (this._layerSpacing !== v) {
      this._layerSpacing = v;
      this.rebuildParticlePlanet();
    }
  }
  @Input() set minSliceRadius(v: number) {
    if (this._minSliceRadius !== v) {
      this._minSliceRadius = v;
      this.rebuildParticlePlanet();
    }
  }
  @Input() set particleSize(v: number) {
    if (this._particleSize !== v) {
      this._particleSize = v;
      this.rebuildParticlePlanet();
    }
  }

  ngOnInit(): void {
    this.initScene();
    this.createParticlePlanet();
    this.ngZone.runOutsideAngular(() => this.animate());
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.particleSystem) {
      this.particleSystem.geometry.dispose();
      if (this.particleSystem.material instanceof THREE.Material) {
        this.particleSystem.material.dispose();
      }
    }
  }

  private initScene(): void {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.createCamera();

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.containerRef.nativeElement.appendChild(this.renderer.domElement);
  }

  private createCamera(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 8;
    const z = 10;

    if (this._perspectiveCamera) {
      this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    } else {
      this.camera = new THREE.OrthographicCamera(
        -viewSize * aspect / 2,
        viewSize * aspect / 2,
        viewSize / 2,
        -viewSize / 2,
        0.1,
        1000
      );
    }
    this.camera.position.z = z;
  }

  private recreateCamera(): void {
    if (!this.camera) return;
    this.createCamera();
  }

  private updateUniforms(): void {
    if (!this.particleSystem?.material || !(this.particleSystem.material instanceof THREE.ShaderMaterial)) return;
    const mat = this.particleSystem.material as THREE.ShaderMaterial;
    const u = mat.uniforms;
    if (u['sizeMultiplier']) (u['sizeMultiplier'] as { value: number }).value = this._sizeMultiplier;
    if (u['color']) (u['color'] as { value: THREE.Color }).value.set(this._color);
  }

  private rebuildParticlePlanet(): void {
    if (!this.scene || !this.particleSystem) return;
    this.scene.remove(this.particleSystem);
    this.particleSystem.geometry.dispose();
    if (this.particleSystem.material instanceof THREE.Material) {
      this.particleSystem.material.dispose();
    }
    this.createParticlePlanet();
  }

  private createParticlePlanet(): void {
    const particleCount = this._particleCount;
    const radius = this._radius;
    const layerCount = this._layerCount;
    const layerSpacing = this._layerSpacing;
    const minSliceRadius = this._minSliceRadius;
    const particleSize = this._particleSize;
    const sizeMultiplier = this._sizeMultiplier;
    const blueColor = new THREE.Color(this._color);
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // First pass: calculate area of each slice to distribute particles proportionally
    const sliceAreas: number[] = [];
    let totalArea = 0;

    for (let layer = 0; layer < layerCount; layer++) {
      // Calculate Y position with spacing adjustment
      const normalizedPosition = layerCount > 1 ? layer / (layerCount - 1) : 0;
      const y = layerCount > 1 
        ? -radius * layerSpacing + (normalizedPosition * (2 * radius * layerSpacing))
        : 0;
      
      // Calculate slice radius based on actual Y position (with spacing)
      // Skip layers that are outside the sphere (|y| > radius)
      if (Math.abs(y) > radius) {
        sliceAreas.push(0); // Layer is outside sphere, no area
        continue;
      }
      
      let sliceRadius = Math.sqrt(Math.max(0, radius * radius - y * y));
      
      if (sliceRadius < minSliceRadius) {
        sliceRadius = minSliceRadius;
      }

      // Area of circle = π * r²
      const area = Math.PI * sliceRadius * sliceRadius;
      sliceAreas.push(area);
      totalArea += area;
    }

    let particleIndex = 0;

    // Create horizontal planar slices that stack to form a sphere
    for (let layer = 0; layer < layerCount; layer++) {
      // Calculate Y position with spacing adjustment
      const normalizedPosition = layerCount > 1 ? layer / (layerCount - 1) : 0;
      const y = layerCount > 1 
        ? -radius * layerSpacing + (normalizedPosition * (2 * radius * layerSpacing))
        : 0;
      
      // Skip layers that are outside the sphere (|y| > radius)
      if (Math.abs(y) > radius) {
        continue;
      }
      
      // Calculate the radius of the circular cross-section based on actual Y position
      // Using sphere equation: r = sqrt(R² - y²)
      let sliceRadius = Math.sqrt(Math.max(0, radius * radius - y * y));
      
      // Only apply minimum radius to slices that are too small (near poles)
      if (sliceRadius < minSliceRadius) {
        sliceRadius = minSliceRadius;
      }

      // Distribute particles proportionally based on slice area for equal density
      const sliceArea = sliceAreas[layer];
      // Skip if this layer has no area (was outside sphere)
      if (sliceArea === 0 || totalArea === 0) {
        continue;
      }
      const particlesInThisLayer = layer === layerCount - 1 
        ? particleCount - particleIndex 
        : Math.floor((sliceArea / totalArea) * particleCount);

      // Distribute particles evenly in a circle on this horizontal plane
      for (let i = 0; i < particlesInThisLayer; i++) {
        const i3 = particleIndex * 3;

        // Uniform angle distribution around the circle
        const angle = (i / particlesInThisLayer) * Math.PI * 2;
        
        // Bias particles heavily towards the outline/edge of the slice
        // Using very low exponent to concentrate particles at the perimeter
        // Mix with a portion that's always near the edge for stronger outline
        const edgeBias = Math.random() < 0.7 
          ? Math.pow(Math.random(), 0.05)  // 70% very close to edge
          : 0.85 + Math.random() * 0.15;   // 30% in outer 15% ring
        const r = sliceRadius * edgeBias;

        // Position on the horizontal plane (X and Z), Y is constant for this layer
        positions[i3] = r * Math.cos(angle);     // X
        positions[i3 + 1] = y;                  // Y (constant for this plane)
        positions[i3 + 2] = r * Math.sin(angle); // Z

        // All particles have the same size
        sizes[particleIndex] = particleSize;
        
        particleIndex++;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create shader material for particles with solid square shape
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sizeMultiplier: { value: sizeMultiplier },
        color: { value: blueColor }
      },
      vertexShader: `
        attribute float size;
        uniform float sizeMultiplier;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * sizeMultiplier;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;

        void main() {
          // Render solid square (default point shape)
          // Reduce brightness by using lower alpha for additive blending
          gl_FragColor = vec4(color, 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    
    // Smoothly interpolate rotation towards target
    this.currentRotationX += (this.targetRotationX - this.currentRotationX) * 0.1;
    this.currentRotationY += (this.targetRotationY - this.currentRotationY) * 0.1;
    
    // Apply rotation to particle system
    if (this.particleSystem) {
      this.particleSystem.rotation.x = this.currentRotationX;
      this.particleSystem.rotation.y = this.currentRotationY;
    }
    
    this.renderer.render(this.scene, this.camera);
  };

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    // Calculate mouse offset from center (normalized -0.5 to 0.5)
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const offsetX = (event.clientX - centerX) / window.innerWidth;
    const offsetY = (event.clientY - centerY) / window.innerHeight;
    
    // Map offset to rotation angles (reduced amplitude, inverted X and Y)
    this.targetRotationY = -offsetX * this._rotationAmplitude;
    this.targetRotationX = -offsetY * this._rotationAmplitude;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const viewSize = 8;

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect;
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.left = -viewSize * aspect / 2;
      this.camera.right = viewSize * aspect / 2;
      this.camera.top = viewSize / 2;
      this.camera.bottom = -viewSize / 2;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
