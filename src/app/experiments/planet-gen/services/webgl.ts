import { Injectable } from '@angular/core';

@Injectable()
export class WebGL {
  private contexts: Map<HTMLCanvasElement, {
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    animationFrameId: number,
    uTimeLoc: WebGLUniformLocation | null,
    iResLoc: WebGLUniformLocation | null,
    uRGBLoc: WebGLUniformLocation | null,
  }> = new Map();

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    const gl = canvas.getContext('webgl', { 
      powerPreference: 'high-performance',
      antialias: false 
    })!;

    const program = await this.createShader(gl);

    const uTimeLoc = gl.getUniformLocation(program, 'uTime');
    const iResLoc = gl.getUniformLocation(program, 'uResolution');
    const uRGBLoc = gl.getUniformLocation(program, 'uRGB');

    // Bind program and set uRGB once at initialization
    gl.useProgram(program);
    if (uRGBLoc) gl.uniform3f(uRGBLoc, 0.3, 0.4, 0.8);

    this.contexts.set(canvas, {
      gl,
      program,
      animationFrameId: 0,
      uTimeLoc,
      iResLoc,
      uRGBLoc,
    });
  }

  private async createShader(gl: WebGLRenderingContext): Promise<WebGLProgram> {
    const vertexShader = await this.loadShader(gl, gl.VERTEX_SHADER, this.vertexShaderSource);
    const fragmentShader = await this.loadShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Unable to initialize shader program: ' + gl.getProgramInfoLog(program));
    }

    this.setupBuffers(gl, program);
    return program;
  }

  private async loadShader(gl: WebGLRenderingContext, type: number, source: string): Promise<WebGLShader> {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  private readonly vertexShaderSource = `
    precision lowp float;
    attribute vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  private readonly fragmentShaderSource = `
    precision lowp float;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec3 uRGB;

    const float scale = 13.;
    const float velocity_x = 0.04;
    const float velocity_y = 0.04;
    const float detail = 10.0;
    const float twist = 0.7;
    const int ITERATIONS = 13;

    float f(in vec2 p) {
      return sin(p.x + sin(p.y + uTime * velocity_x)) * sin(p.y * p.x * 0.1 + uTime * velocity_y);
    }

    vec2 fieldFast(in vec2 p) {
      const vec2 ep = vec2(0.05, 0.0);
      float phase = uTime * 0.1;
      float sA = sin(phase) * 0.1;
      float sB = sin(phase) * 0.1;

      vec2 rz = vec2(0.0);
      for (int i = 0; i < ITERATIONS; i++) {
        float t0 = f(p);
        float t1 = f(p + ep.xy);
        float t2 = f(p + ep.yx);
        vec2 g = (vec2(t1 - t0, t2 - t0)) / ep.xx;
        vec2 t = vec2(-g.y, g.x);
        p += twist * t + g * (1.0 / detail);
        p.x += sA;
        p.y += sB;
        rz = g;
      }
      return rz;
    }

    void main() {
      vec2 p = gl_FragCoord.xy / uResolution.xy - 0.5;
      p.x *= uResolution.x / uResolution.y;
      p *= scale;

      vec2 v = fieldFast(p);
      vec3 col = vec3(uRGB.x, v.y * 0.5 + uRGB.y, uRGB.z) * 0.85;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  private setupBuffers(gl: WebGLRenderingContext, program: WebGLProgram): void {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  }

  resize(canvas: HTMLCanvasElement): void {
    const context = this.contexts.get(canvas);
    if (!context) return;

    const { gl } = context;
    const displayWidth = Math.floor(canvas.clientWidth * 0.5);
    const displayHeight = Math.floor(canvas.clientHeight * 0.5);
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }
  }

  animate(canvas: HTMLCanvasElement): void {
    const context = this.contexts.get(canvas);
    if (!context) return;

    const { gl, program, uTimeLoc, iResLoc, uRGBLoc } = context;
    
    gl.useProgram(program);
    if (uTimeLoc) gl.uniform1f(uTimeLoc, performance.now() / 1000);
    if (iResLoc) gl.uniform2f(iResLoc, gl.canvas.width, gl.canvas.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    context.animationFrameId = requestAnimationFrame(() => this.animate(canvas));
  }

  cleanup(canvas: HTMLCanvasElement): void {
    const context = this.contexts.get(canvas);
    if (!context) return;

    const { gl, program, animationFrameId } = context;
    cancelAnimationFrame(animationFrameId);
    gl.deleteProgram(program);
    this.contexts.delete(canvas);
  }
} 