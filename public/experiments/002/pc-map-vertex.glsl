precision mediump float;
const float PI = 3.1415;
uniform float uGlobalTime;
const int MAX_CLICKS = 20;
uniform vec3 uClickPos[MAX_CLICKS];
uniform float uClickTime[MAX_CLICKS];
uniform int uClickCount;

uniform float uProgress;
uniform float uMaxDistance;
uniform vec3 uIntroCenter;
uniform float uClickRadius;
uniform float uMaxClickDuration;
uniform float uClickStrength;
uniform float uMoveWindow;
uniform float uCenterRadius;
uniform float uCenterFalloff;
uniform float uPointSize;

attribute vec3 originalPosition;

varying vec3 vColor;
varying float vAlpha;

float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p += dot(p, p.yzx + 19.19);
  return fract(p.x * p.y * p.z);
}

// basic in-out
float easeBounce(float t) {
  return sin(t * PI);
}

vec3 xplosion(vec3 currentPosition) {
  float bestScore = 0.0;
  vec3 bestDir = vec3(0.0);
  float invClickRadius = 1.0 / uClickRadius;

  for (int i = 0; i < MAX_CLICKS; i++) {
    // Mask out inactive clicks to avoid dynamic loop break/divergence
    float clickMask = step(0.5, float(uClickCount) - float(i));
    vec3 toCenter = currentPosition - uClickPos[i];
    float dist = length(toCenter);

    float rnd = hash31(originalPosition + float(i));
    float duration = mix(0.8, uMaxClickDuration, rnd);
    float t = clamp((uGlobalTime - uClickTime[i]) / duration, 0.0, 1.0);
    float easedT = easeBounce(t) * step(dist, uClickRadius);

    float falloff = max((uClickRadius - dist) * invClickRadius, 0.0);
    float strength = mix(1.2, 2.5, rnd) * falloff * uClickStrength;
    vec3 dir = toCenter / max(dist, 1e-6);

    float score = clickMask * easedT * strength;

    float choose = step(bestScore, score);
    bestScore = mix(bestScore, score, choose);
    bestDir = mix(bestDir, dir, choose);
  }

  return currentPosition + bestDir * bestScore;
}

// Evaluate cubic bezier at time t with given control points
float cubicBezier(float t, float x1, float y1, float x2, float y2) {
  // Newton-Raphson iteration to solve for bezier X(t) = t
  float u = t;
  for (int i = 0; i < 5; i++) {
    float it = 1.0 - u;
    float u2 = u * u;
    float u3 = u2 * u;
    float it2 = it * it;
    float x = 3.0 * x1 * it2 * u + 3.0 * x2 * it * u2 + u3;
    float dx = 3.0 * x1 * (it2 - 2.0 * it * u) + 3.0 * x2 * (2.0 * it * u - u2) + 3.0 * u2;
    u = clamp(u - (x - t) / dx, 0.0, 1.0);
  }

  // Use u to compute Bezier Y
  float it = 1.0 - u;
  float u2 = u * u;
  float u3 = u2 * u;
  float it2 = it * it;
  float y = 3.0 * y1 * it2 * u + 3.0 * y2 * it * u2 + u3;
  return y;
}

void main() {
  // Precompute center direction and distance
  vec3 dirFromCenter = originalPosition - uIntroCenter;
  float distToCenter = length(dirFromCenter);
  float invMaxDist = 1.0 / max(uMaxDistance, 1e-6);

  float normalizedDist = distToCenter * invMaxDist;
  float noise = hash31(originalPosition);
  float jitter = noise * 0.1;
  float revealThreshold = normalizedDist + jitter;
  float reveal = step(revealThreshold, cubicBezier(uProgress, 0.84, 0.02, 0.66, 0.66));
  
  // Animate particles near the center from the center to their original position
  // as uProgress goes from 0.0 to 0.45. Beyond that, they should be at original positions.
  // Randomized transition start per particle
  float randSeed = hash31(originalPosition * 1.23 + vec3(7.1, 3.3, 5.9));
  float startOffset = randSeed * 0.30 * uMoveWindow; // up to 30% of the window as delay
  // Randomized per-particle speed factor (wider spread for more difference)
  float randSpeed = hash31(originalPosition * 2.07 + vec3(1.9, 4.2, 3.1));
  float speedFactor = mix(0.45, 2.0, randSpeed); // 0.45x to 2.0x duration
  float moveT = clamp((uProgress - startOffset) / (uMoveWindow * speedFactor), 0.0, 1.0);
  // Per-particle easing exponent for additional variation
  float randEase = hash31(originalPosition * 0.73 + vec3(9.7, 2.5, 1.1));
  float easeExp = mix(1.5, 4.0, randEase);
  // Ease so particles stay closer to center longer (stronger attraction) on average
  float moveEase = pow(moveT, easeExp);
  // Influence mask: fully influenced inside radius, then fall off quickly outside
  float centerInfluence = 1.0 - smoothstep(uCenterRadius, uCenterRadius + uCenterFalloff, normalizedDist);
  // Boost influence for stronger attraction
  centerInfluence = sqrt(max(centerInfluence, 0.0));
  // First compute the center-to-original trajectory, then blend by proximity influence
  vec3 centerLerp = mix(uIntroCenter, originalPosition, moveEase);
  vec3 basePos = mix(originalPosition, centerLerp, centerInfluence);
  
  // At start, hard-snap all particles inside the radius exactly to the center
  float isAtStart = 1.0 - smoothstep(0.0, 0.005, uProgress);
  float insideRadius = step(normalizedDist, uCenterRadius);
  basePos = mix(basePos, uIntroCenter, isAtStart * insideRadius);
  
  // Smooth alpha transition for center-affected particles:
  // fully opaque at start, then fade into the reveal toward movement completion
  float started = step(startOffset, uProgress);
  float insideR = step(normalizedDist, uCenterRadius);
  float fade = smoothstep(0.80, 1.00, moveT);
  float centerAlpha = mix(1.0, reveal, fade);
  vAlpha = mix(reveal, centerAlpha, insideR);
  
  // Apply click-based displacement on top of the base position,
  // but do NOT allow explosion before a particle's transition starts inside the radius
  vec3 exploded = xplosion(basePos);
  float allowExplosion = 1.0 - ((1.0 - started) * insideR);
  vec3 finalPos = mix(basePos, exploded, allowExplosion);

  vColor = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  gl_PointSize = uPointSize;
}