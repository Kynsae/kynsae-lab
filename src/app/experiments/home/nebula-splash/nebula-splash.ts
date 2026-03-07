import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

const VERTEX_SHADER = `#version 300 es
  in vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;

out vec4 fragColor;

const int ITERATIONS = 100;
const float BASE_STEP = 0.01;
const float STEP_GAIN = 0.1;

// Fixed rotation (0.25 rad) - precomputed to avoid sin/cos per iteration
const mat2 ROT25 = mat2(0.9689, -0.2474, 0.2474, 0.9689);

// Dark-mode filament palette (slightly brighter)
vec3 palette(float t){
  vec3 a = vec3(0.05,0.05,0.08);
  vec3 b = vec3(0.48,0.38,0.9);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0,0.15,0.35);
  return a + b * cos(6.28318 * (c*t + d));
}

// Twisting flow (mouse pull scaled by depth only, not time, so effect stays stable)
vec2 twistFlow(vec2 pos, float z, float time, vec2 mouse){
    float angle = 0.5 * sin(z*0.8) + 0.3 * cos(z*0.6);
    float c = cos(angle);
    float s = sin(angle);
    float depth = z - time;
    float scale = 0.5 + 0.12 * depth;
    vec2 mousePull = (mouse - 0.5) * scale;
    pos += 0.2 * vec2(sin(z*1.5 + pos.y*2.0), cos(z*1.3 + pos.x*2.5)) + mousePull * vec2(c, s);
    return mat2(c, -s, s, c) * pos;
}

// Turbulence: curl + uniform mouse swirl (same direction at all depths so all filaments react)
vec2 turbulence(vec2 pos, float z, float time, vec2 mouse){
    vec2 m = (mouse - 0.5);
    float swirl = 0.28 * (0.1 + 0.3 * sin(z * 0.1));
    vec2 vortex = vec2(-m.y, m.x) * swirl * 0.1;

    float n = sin(pos.x*2.3 + z*0.1) * cos(pos.y*2.7 - z*0.5) + time*0.2;
    vec2 curl = vec2(cos(pos.y*3.2 + n), sin(pos.x*3.5 - n)) * 0.12;
    return curl + vortex;
}

void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*iResolution) / iResolution.y;

    // Mouse parallax: subtle offset so nebula follows cursor (iMouse in 0..1, center 0.5)
    vec2 mouseOffset = (iMouse - 0.5) * 0.13;
    uv -= mouseOffset;

    float time = iTime * 0.25;
    vec3 accum = vec3(0.0);
    float stepSize = 0.0;
    float dist = 0.0;

    for(int i=0; i<ITERATIONS; i++){
        float fi = float(i);

        stepSize = BASE_STEP + abs(stepSize) * STEP_GAIN;
        dist += stepSize;

        // Base position
        vec3 p = vec3(uv * dist * 2.0, dist + time);

        // Apply twisting flow instead of simple spiral (mouse affects flow)
        p.xy = twistFlow(p.xy, p.z, time, iMouse);

        p.xy = ROT25 * p.xy;

        // Turbulence: permanently warp the coordinates used for the filament field
        p.xy += turbulence(p.xy, p.z, time, iMouse);

        // Sharp filament field (sampled at warped position — shapes are distorted)
        float r = length(p.xy);
        float field = cos(r*15.0 - p.z*4.0) + cos(p.x*7.0 + p.y*6.0 + p.z*2.5);

        // Sharpen filaments
        float filament = pow(1.0 / (1.1 + abs(field)*5.0), 2.0);

        // Continuous accumulation
        vec3 col = palette(r*0.5 + fi*0.01);
        accum += col * filament * 0.04;

        stepSize += field * 0.1;
    }

    fragColor = vec4(accum,1.0);
}
`;

@Component({
  selector: 'app-nebula-splash',
  templateUrl: './nebula-splash.html',
  styleUrl: './nebula-splash.scss',
})
export class NebulaSplash implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private uMouseLoc: WebGLUniformLocation | null = null;
  private rafId = 0;
  private resizeObserver: ResizeObserver | null = null;
  private mouse = { x: 0.5, y: 0.5 };
  private targetMouse = { x: 0.5, y: 0.5 };
  private readonly mouseLerp = 0.07;
  /** Render at this scale of container size (1 = full res, 0.5 = half = 4x fewer pixels) */
  private readonly renderScale = 0.5;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      powerPreference: 'high-performance',
      antialias: false,
      failIfMajorPerformanceCaveat: false,
    }) as WebGL2RenderingContext | null;
    if (!gl) return;

    const vs = this.compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Shader link:', gl.getProgramInfoLog(program));
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.gl = gl;
    this.program = program;
    this.uResolutionLoc = gl.getUniformLocation(program, 'iResolution');
    this.uTimeLoc = gl.getUniformLocation(program, 'iTime');
    this.uMouseLoc = gl.getUniformLocation(program, 'iMouse');

    // Global mouse: use window so position is tracked even when pointer is over elements on top.
    // Do not recenter on leave — keeps last position so return from off-screen is smooth.
    this.boundMouseMove = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width || 1;
      const h = rect.height || 1;
      this.targetMouse.x = Math.max(0.0, Math.min(1.0, (e.clientX - rect.left) / w));
      this.targetMouse.y = Math.max(0.0, Math.min(1.0, 1.0 - (e.clientY - rect.top) / h));
    };
    window.addEventListener('mousemove', this.boundMouseMove, { passive: true });

    const resize = (): void => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const rw = Math.max(1, Math.floor(w * this.renderScale));
      const rh = Math.max(1, Math.floor(h * this.renderScale));
      if (canvas.width !== rw || canvas.height !== rh) {
        canvas.width = rw;
        canvas.height = rh;
        gl.viewport(0, 0, rw, rh);
      }
    };
    resize();
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(canvas);

    const tick = (): void => {
      if (!this.gl || !this.program) return;
      this.mouse.x += (this.targetMouse.x - this.mouse.x) * this.mouseLerp;
      this.mouse.y += (this.targetMouse.y - this.mouse.y) * this.mouseLerp;
      const g = this.gl;
      g.useProgram(this.program);
      if (this.uResolutionLoc) g.uniform2f(this.uResolutionLoc, g.canvas.width, g.canvas.height);
      if (this.uTimeLoc) g.uniform1f(this.uTimeLoc, performance.now() / 1000);
      if (this.uMouseLoc) g.uniform2f(this.uMouseLoc, this.mouse.x, this.mouse.y);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  private compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    if (this.boundMouseMove) window.removeEventListener('mousemove', this.boundMouseMove);
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
  }
}
