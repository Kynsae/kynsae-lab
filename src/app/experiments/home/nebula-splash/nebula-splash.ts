import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

const VERTEX_SHADER = `#version 300 es
  in vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform float iTime;

out vec4 fragColor;

const int ITERATIONS = 120;
const float BASE_STEP = 0.012;
const float STEP_GAIN = 0.1;

// 2D rotation matrix
mat2 rot(float a){
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

// Dark-mode filament palette
vec3 palette(float t){
    vec3 a = vec3(0.02,0.02,0.04);
    vec3 b = vec3(0.3,0.2,0.6);
    vec3 c = vec3(1.0);
    vec3 d = vec3(0.0,0.15,0.35);
    return a + b*cos(6.28318*(c*t + d));
}

// New twisting flow movement
vec2 twistFlow(vec2 pos, float z){
    float angle = 0.5 * sin(z*0.8) + 0.3 * cos(z*0.6);
    float offsetX = 0.2 * sin(z*1.5 + pos.y*2.0);
    float offsetY = 0.2 * cos(z*1.3 + pos.x*2.5);
    pos += vec2(offsetX, offsetY);
    pos = pos * mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    return pos;
}

void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*iResolution) / iResolution.y;

    float time = iTime * 0.3;
    vec3 accum = vec3(0.0);
    float stepSize = 0.0;
    float dist = 0.0;

    for(int i=0; i<ITERATIONS; i++){
        float fi = float(i);

        stepSize = BASE_STEP + abs(stepSize) * STEP_GAIN;
        dist += stepSize;

        // Base position
        vec3 p = vec3(uv * dist * 2.0, dist + time);

        // Apply twisting flow instead of simple spiral
        p.xy = twistFlow(p.xy, p.z);

        // Slight structure rotation
        p.xy *= rot(0.25);

        // Sharp filament field
        float r = length(p.xy);
        float field = cos(r*15.0 - p.z*4.0) + cos(p.x*7.0 + p.y*6.0 + p.z*2.5);

        // Sharpen filaments
        float filament = pow(1.0 / (1.0 + abs(field)*5.0), 2.0);

        // Continuous accumulation
        vec3 col = palette(r*0.25 + p.z*0.05 + fi*0.01);
        accum += col * filament * 0.05;

        stepSize += field * 0.1;
    }

    // Depth boost
    accum = pow(accum, vec3(1.6));

    fragColor = vec4(accum,1.0);
}
`;

@Component({
  selector: 'app-nebula-splash',
  imports: [],
  templateUrl: './nebula-splash.html',
  styleUrl: './nebula-splash.scss',
})
export class NebulaSplash implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private uResolutionLoc: WebGLUniformLocation | null = null;
  private uTimeLoc: WebGLUniformLocation | null = null;
  private rafId = 0;
  private resizeObserver: ResizeObserver | null = null;

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

    const resize = (): void => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(canvas);

    const tick = (): void => {
      if (!this.gl || !this.program) return;
      const g = this.gl;
      g.useProgram(this.program);
      if (this.uResolutionLoc) g.uniform2f(this.uResolutionLoc, g.canvas.width, g.canvas.height);
      if (this.uTimeLoc) g.uniform1f(this.uTimeLoc, performance.now() / 1000);
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
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
  }
}
