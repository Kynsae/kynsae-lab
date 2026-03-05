import { Injectable } from '@angular/core';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

const T = THREE as any;

@Injectable()
export class TorusTextService {
  private readonly TEXT_SIZE = 0.39;
  private readonly TEXT_DEPTH = 0.12;
  private readonly TEXT_CURVE_SEGMENTS = 10;
  private readonly TEXT_TRACKING_MULTIPLIER = 0.1;
  private readonly TEXT_SPACING_FACTOR = 1.06;
  private readonly TEXT_MIN_CURVE_RADIUS = 0.0;
  private readonly SHADER_BASE_COLOR = new T.Color(0.2, 0.4, 1.0);
  private readonly SHADER_LIGHT_DIRECTION = new T.Vector3(0.5, 0.8, 1.0).normalize();
  private readonly SHADER_MIN_LAMBERT = 0.12;

  private fontLoader = new FontLoader();
  private ttfLoader = new TTFLoader();

  private torusTextMesh?: any;
  private readonly colorPalette: (number | string)[] = [0xff4d4d, 0x4dff88, 0x4da6ff, 0xffb84d, 0xd64dff];
  private colorIndex = 0;

  async init(
    fontUrl: string, 
    torusText: string, 
    centerText: string
  ): Promise<{mesh: any, rCurve: number, centerMesh: any}> {
    const font = this.fontLoader.parse(await this.ttfLoader.loadAsync(fontUrl));

    return {
      ...this.createCurvedTextMesh(font, torusText),
      centerMesh: this.createCenterTextMesh(font, centerText)
    };
  }

  private createCurvedTextMesh(font: any, text: string): { mesh: any; rCurve: number } {
    const { geom, width } = this.buildTextGeometry(font, text);
    const rCurve = Math.max(this.TEXT_MIN_CURVE_RADIUS, (width * this.TEXT_SPACING_FACTOR) / (Math.PI * 2));

    this.bendGeometryAroundZ(geom, rCurve);
    geom.computeVertexNormals();
    
    this.torusTextMesh = new T.Mesh(
      geom, 
      this.createTextShaderMaterial(this.SHADER_BASE_COLOR)
    )
    
    return { 
      mesh: this.torusTextMesh, 
      rCurve 
    };
  }

  private createCenterTextMesh(font: any, text: string): any {
    return new T.Mesh(
      this.buildTextGeometry(font, text).geom,
      new T.MeshBasicMaterial({
        color: 0xffffff,
        side: T.FrontSide
      })
    );
  }

  private buildTextGeometry(
    font: any, 
    text: string
  ): { geom: any; width: number } {
    const tracking = this.TEXT_SIZE * this.TEXT_TRACKING_MULTIPLIER;
  
    let cursorX = 0;
    const geoms: any[] = [];
  
    for (const ch of text) {
      const geom = new TextGeometry(ch, {
        font,
        size: this.TEXT_SIZE,
        depth: this.TEXT_DEPTH,
        curveSegments: this.TEXT_CURVE_SEGMENTS,
        bevelEnabled: false,
      });
  
      geom.computeBoundingBox();
      const bb = geom.boundingBox!;
      const glyphWidth = Math.max(0, bb.max.x - bb.min.x) || this.TEXT_SIZE * 0.35;
  
      // Position the character geometry
      geom.translate(-bb.min.x + cursorX, 0, -bb.min.z);
      geoms.push(geom);
  
      cursorX += glyphWidth + tracking;
    }
  
    // Merge all geometries into one
    const merged = mergeGeometries(geoms, false)!;
    geoms.forEach(g => g.dispose()); // Dispose to free GPU memory

    // Only convert to non-indexed if the merged geometry is indexed,
    // to avoid THREE.BufferGeometry.toNonIndexed() warnings.
    const geom = merged.index ? merged.toNonIndexed() : merged;
    geom.computeBoundingBox();
  
    const { min, max } = geom.boundingBox!;
    const width = max.x - min.x;
    const height = max.y - min.y;
    const depth = max.z - min.z;
  
    // Center the geometry
    geom.translate(-(min.x + width / 2), -(min.y + height / 2), -(min.z + depth / 2));
  
    return { geom, width };
  }

  private createTextShaderMaterial(baseColor: number | string): any {
    const vertexShader = `
      precision lowp float;
      varying vec3 vNormal;

      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragmentShader = `
      precision lowp float;
      varying vec3 vNormal;
      uniform vec3 uLightDir;
      uniform vec3 uBaseColor;
      uniform float uMinLambert;

      void main() {
        gl_FragColor = vec4(uBaseColor * max(dot(normalize(vNormal), normalize(uLightDir)), uMinLambert), 1.0);
      }
    `;
    return new T.ShaderMaterial({
      uniforms: {
        uLightDir: { value: this.SHADER_LIGHT_DIRECTION },
        uBaseColor: { value: baseColor },
        uMinLambert: { value: this.SHADER_MIN_LAMBERT }
      },
      vertexShader,
      fragmentShader
    });
  }

  private bendGeometryAroundZ(geometry: any, curvatureRadius: number) {
    const pos = geometry.getAttribute('position');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const theta = x / Math.max(1e-6, curvatureRadius);
      const r = curvatureRadius + z;
      const nx = Math.cos(theta) * r;
      const ny = Math.sin(theta) * r;
      const nz = y;
      pos.setXYZ(i, nx, ny, nz);
    }
  }

  cycleTextColor() {
    if (!this.torusTextMesh) return;
    const uniforms = (this.torusTextMesh.material as any)?.uniforms;
    if (!uniforms?.uBaseColor) return;
    const next = this.colorPalette[this.colorIndex++ % this.colorPalette.length];
    uniforms.uBaseColor.value.set(next as any);
  }
}