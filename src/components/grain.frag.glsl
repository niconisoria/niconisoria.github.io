#version 300 es
// Seven evenly spaced, wavy grain lines (blue and roasted-maple wood, alternating)
// on a transparent ground, slowly flowing and bending around the pointer.
precision highp float;

uniform float u_time;
// shared with Paper's vertex shader (mediump): precisions must match or Metal/ANGLE refuses to link
uniform mediump vec2 u_resolution;
uniform vec2 u_pointer; // hero space (centre 0, height 1, y up); far away when idle
uniform float u_reveal; // 0 → 1 load-in, lines grow out from the centre

out vec4 fragColor;

const float LINES = 7.0;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;
  float aspect = u_resolution.x / u_resolution.y;
  float r = length(uv / vec2(0.5 * aspect, 0.5)); // 1.0 at the edge midpoints, ~1.4 in corners
  float t = u_time;

  // field in line units: integers -3..3 are the seven lines across the hero height.
  // Big waves bend all lines together (shared offset in hero units), so they swing a lot
  // without touching; the small per-line noise on top keeps them from looking parallel.
  vec2 p = uv + vec2(t * 0.025, 0.0);
  float sway = 0.06 * sin(p.x * 3.2 + uv.y * 2.0 + t * 0.2)
             + 0.035 * sin(p.x * 6.3 - uv.y * 3.0 - t * 0.15)
             + 0.02 * sin(p.x * 11.0 + uv.y * 5.0 + t * 0.3);
  // lines use the middle 82% of the height: the largest sway (0.115) never reaches the edge
  float f = (uv.y + sway) * LINES / 0.82;
  f += (noise(p * vec2(1.6, 3.0) + vec2(0.0, t * 0.03)) - 0.5) * 0.35;

  // pointer bends nearby lines
  vec2 dp = uv - u_pointer;
  f += 0.25 * exp(-dot(dp, dp) * 14.0);

  float n = clamp(floor(f + 0.5), -3.0, 3.0); // which line this pixel belongs to
  float fw = fwidth(f);

  // grain-like thickness: varies a little along each line
  float thick = 1.0 + 0.6 * noise(vec2(n * 3.7, p.x * 2.0));
  float line = 1.0 - smoothstep(fw * thick, fw * (thick + 1.0), abs(f - n));

  // alternate blue and wood; blue shades vary per line
  vec3 blue = mix(vec3(0.106, 0.388, 0.651), vec3(0.310, 0.639, 0.863), hash(vec2(n, 1.1)));
  vec3 wood = vec3(0.788, 0.522, 0.180);
  vec3 col = mod(n, 2.0) < 0.5 ? wood : blue;

  // load-in: lines grow out from the centre
  float revealR = u_reveal * 1.6;
  float inside = 1.0 - smoothstep(revealR - 0.2, revealR, r);

  float alpha = line * inside * 0.9;
  fragColor = vec4(col * alpha, alpha);
}
