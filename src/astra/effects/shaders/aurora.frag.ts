export const auroraFragmentShader = /* glsl */ `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_mouse_velocity;
uniform float u_scroll;
uniform vec3 u_color_bg;
uniform vec3 u_color_primary;
uniform vec3 u_color_secondary;
uniform vec3 u_color_accent;
uniform float u_intensity;

varying vec2 vUv;

// Simplex 2D noise helper
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Multi-octave Fractal Brownian Motion (FBM)
float fbm(vec2 p) {
  float f = 0.0;
  float w = 0.5;
  for (int i = 0; i < 5; i++) {
    f += w * snoise(p);
    p = p * 2.02 + vec2(1.3, 0.8);
    w *= 0.5;
  }
  return f;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 st = (uv - 0.5) * vec2(aspect, 1.0);

  // Mouse interaction: gravity & ripple displacement
  vec2 mouseSt = (u_mouse - 0.5) * vec2(aspect, 1.0);
  float distToMouse = length(st - mouseSt);
  float mouseRipple = exp(-distToMouse * 4.0) * (0.08 + u_mouse_velocity * 0.15);
  vec2 mouseDir = (distToMouse > 0.001) ? normalize(st - mouseSt) : vec2(0.0);
  st += mouseDir * mouseRipple;

  // Domain Warping for fluid-like Astra Aurora
  float t = u_time * 0.18;
  float scrollFactor = u_scroll * 1.5;

  vec2 q = vec2(
    fbm(st * 1.6 + vec2(0.0, t * 0.8 + scrollFactor)),
    fbm(st * 1.6 + vec2(4.3, 2.8 - t * 0.6))
  );

  vec2 r = vec2(
    fbm(st * 2.2 + 3.0 * q + vec2(1.7, 9.2) + 0.15 * t),
    fbm(st * 2.2 + 3.0 * q + vec2(8.3, 2.8) + 0.126 * t)
  );

  float f = fbm(st * 2.5 + 4.0 * r + vec2(t * 0.2, scrollFactor * 0.5));

  // Color Mapping
  // Background to Primary
  float mix1 = smoothstep(-0.2, 0.45, f);
  vec3 col = mix(u_color_bg, u_color_primary, mix1);

  // Blend Secondary (Cyan)
  float mix2 = smoothstep(0.1, 0.7, length(q));
  col = mix(col, u_color_secondary, mix2 * 0.85);

  // High energy Accent (Gold/White core)
  float mix3 = smoothstep(0.5, 0.95, r.x * f);
  col = mix(col, u_color_accent, mix3 * 0.9);

  // Subtle vignette
  float vignette = 1.0 - smoothstep(0.5, 1.4, length((uv - 0.5) * vec2(aspect, 1.0)));
  col *= (0.8 + 0.2 * vignette) * u_intensity;

  // Soft atmospheric glow
  col += u_color_secondary * (0.04 * (1.0 - distToMouse));

  gl_FragColor = vec4(col, 1.0);
}
`;
