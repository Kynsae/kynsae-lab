varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 center = gl_PointCoord - 0.5;
  if (length(center) > 0.5) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}