import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
void main(){
  gl_Position = vec4(a_position,0.0,1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 iResolution;
uniform float iTime;

uniform vec2 iMouse;
uniform float iMouseStrength;
uniform float iMouseRadius;
uniform float iMouseSwirl;
uniform float iMousePull;

out vec4 fragColor;

const int ITERATIONS = 120;
const float BASE_STEP = 0.012;
const float STEP_GAIN = 0.1;

const float ROT_A = 0.25;
const float ROT_S = sin(ROT_A);
const float ROT_C = cos(ROT_A);

vec3 palette(float t){
  vec3 a = vec3(0.02,0.02,0.04);
  vec3 b = vec3(0.3,0.2,0.6);
  vec3 c = vec3(1.0);
  vec3 d = vec3(0.0,0.15,0.35);
  return a + b*cos(6.28318*(c*t + d));
}

vec2 rot(vec2 p, float a){
  float s = sin(a);
  float c = cos(a);
  return vec2(
    c*p.x - s*p.y,
    s*p.x + c*p.y
  );
}

vec2 twistFlow(vec2 pos, float z){

  float a = 0.5 * sin(z*0.8) + 0.3 * cos(z*0.6);

  float ox = 0.2 * sin(z*1.5 + pos.y*2.0);
  float oy = 0.2 * cos(z*1.3 + pos.x*2.5);

  pos += vec2(ox,oy);

  float s = sin(a);
  float c = cos(a);

  return vec2(
    c*pos.x - s*pos.y,
    s*pos.x + c*pos.y
  );
}

void main(){

  vec2 uv = (gl_FragCoord.xy - 0.5*iResolution) / iResolution.y;
  float time = iTime * 0.3;

  vec2 mouse = (iMouse - 0.5*iResolution) / iResolution.y;

  float md = length(uv - mouse);

  float influence =
    exp(-md * iMouseRadius) *
    iMouseStrength;

  vec2 dir = uv - mouse;

  dir = rot(dir, influence * iMouseSwirl);

  uv = mouse + dir;

  uv += normalize(mouse - uv) * influence * iMousePull;

  vec3 accum = vec3(0.0);

  float stepSize = 0.0;
  float dist = 0.0;

  for(int i=0;i<ITERATIONS;i++){

    float fi = float(i);

    stepSize = BASE_STEP + abs(stepSize) * STEP_GAIN;
    dist += stepSize;

    vec3 p = vec3(uv * dist * 2.0, dist + time);

    p.xy = twistFlow(p.xy, p.z);

    // precomputed rotation
    p.xy = vec2(
      ROT_C*p.x - ROT_S*p.y,
      ROT_S*p.x + ROT_C*p.y
    );

    float r = length(p.xy);

    float field =
      cos(r*15.0 - p.z*4.0) +
      cos(p.x*7.0 + p.y*6.0 + p.z*2.5);

    float filament =
      pow(1.0 / (1.0 + abs(field)*5.0), 2.0);

    vec3 col =
      palette(r*0.25 + p.z*0.05 + fi*0.01);

    accum += col * filament * 0.05;

    stepSize += field * 0.1;
  }

  accum = pow(accum, vec3(1.6));

  fragColor = vec4(accum,1.0);
}
`;

@Component({
  selector: 'app-nebula-splash',
  templateUrl: './nebula-splash.html',
  styleUrl: './nebula-splash.scss',
})
export class NebulaSplash implements AfterViewInit, OnDestroy {

  @ViewChild('canvas', { static:true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;

  private rafId = 0;
  private resizeObserver: ResizeObserver | null = null;

  private mouse = {x:0,y:0};

  private uResolution!: WebGLUniformLocation;
  private uTime!: WebGLUniformLocation;
  private uMouse!: WebGLUniformLocation;

  private uStrength!: WebGLUniformLocation;
  private uRadius!: WebGLUniformLocation;
  private uSwirl!: WebGLUniformLocation;
  private uPull!: WebGLUniformLocation;

  mouseStrength = 1.0;
  mouseRadius = 4;
  mouseSwirl = .1;
  mousePull = 0.15;

  ngAfterViewInit(){

    const canvas = this.canvasRef.nativeElement;

    const gl = canvas.getContext('webgl2',{
      powerPreference:'high-performance',
      antialias:false,
      depth:false,
      stencil:false,
      alpha:false
    }) as WebGL2RenderingContext;

    this.gl = gl;

    const vs = this.compile(gl,gl.VERTEX_SHADER,VERTEX_SHADER);
    const fs = this.compile(gl,gl.FRAGMENT_SHADER,FRAGMENT_SHADER);

    const program = gl.createProgram()!;
    gl.attachShader(program,vs);
    gl.attachShader(program,fs);
    gl.linkProgram(program);

    this.program = program;

    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1,-1,1,-1,-1,1,1,1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program,'a_position');

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);

    this.uResolution = gl.getUniformLocation(program,'iResolution')!;
    this.uTime = gl.getUniformLocation(program,'iTime')!;
    this.uMouse = gl.getUniformLocation(program,'iMouse')!;

    this.uStrength = gl.getUniformLocation(program,'iMouseStrength')!;
    this.uRadius = gl.getUniformLocation(program,'iMouseRadius')!;
    this.uSwirl = gl.getUniformLocation(program,'iMouseSwirl')!;
    this.uPull = gl.getUniformLocation(program,'iMousePull')!;

    const resize = () => {

      const dpr = Math.min(window.devicePixelRatio,1.5);

      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);

      if(canvas.width !== w || canvas.height !== h){

        canvas.width = w;
        canvas.height = h;

        gl.viewport(0,0,w,h);
      }
    };

    resize();

    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(canvas);

    canvas.addEventListener('mousemove',(e)=>{

      const r = canvas.getBoundingClientRect();

      this.mouse.x = (e.clientX - r.left) * (canvas.width/r.width);
      this.mouse.y = (r.bottom - e.clientY) * (canvas.height/r.height);

    });

    const render = () => {

      const g = this.gl!;

      g.useProgram(this.program);

      g.uniform2f(this.uResolution,g.canvas.width,g.canvas.height);
      g.uniform1f(this.uTime,performance.now()*0.001);

      g.uniform2f(this.uMouse,this.mouse.x,this.mouse.y);

      g.uniform1f(this.uStrength,this.mouseStrength);
      g.uniform1f(this.uRadius,this.mouseRadius);
      g.uniform1f(this.uSwirl,this.mouseSwirl);
      g.uniform1f(this.uPull,this.mousePull);

      g.drawArrays(g.TRIANGLE_STRIP,0,4);

      this.rafId = requestAnimationFrame(render);
    };

    render();
  }

  compile(gl:WebGL2RenderingContext,type:number,src:string){

    const s = gl.createShader(type)!;
    gl.shaderSource(s,src);
    gl.compileShader(s);
    return s;
  }

  ngOnDestroy(){

    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
  }
}