function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash2(x, y, seed) {
  let n = x * 374761393 + y * 668265263 + seed * 1442695040888963407n;
  n = (n ^ (n >> 13n)) * 1274126177n;
  n ^= n >> 16n;
  return Number((n & 0xffffffffn)) / 0xffffffff;
}

function hash3(x, y, z, seed) {
  let n = BigInt(x) * 374761393n + BigInt(y) * 668265263n + BigInt(z) * 2147483647n + BigInt(seed) * 1442695040888963407n;
  n = (n ^ (n >> 13n)) * 1274126177n;
  n ^= n >> 16n;
  return Number((n & 0xffffffffn)) / 0xffffffff;
}

export class Noise {
  constructor(seed = 1) {
    this.seed = BigInt(seed);
  }

  value2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const a = hash2(xi, yi, this.seed);
    const b = hash2(xi + 1, yi, this.seed);
    const c = hash2(xi, yi + 1, this.seed);
    const d = hash2(xi + 1, yi + 1, this.seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
  }

  value3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const n000 = hash3(xi, yi, zi, this.seed);
    const n100 = hash3(xi + 1, yi, zi, this.seed);
    const n010 = hash3(xi, yi + 1, zi, this.seed);
    const n110 = hash3(xi + 1, yi + 1, zi, this.seed);
    const n001 = hash3(xi, yi, zi + 1, this.seed);
    const n101 = hash3(xi + 1, yi, zi + 1, this.seed);
    const n011 = hash3(xi, yi + 1, zi + 1, this.seed);
    const n111 = hash3(xi + 1, yi + 1, zi + 1, this.seed);
    const x00 = lerp(n000, n100, u);
    const x10 = lerp(n010, n110, u);
    const x01 = lerp(n001, n101, u);
    const x11 = lerp(n011, n111, u);
    const y0 = lerp(x00, x10, v);
    const y1 = lerp(x01, x11, v);
    return lerp(y0, y1, w) * 2 - 1;
  }

  fbm2(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.value2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  fbm3(x, y, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.value3(x * freq, y * freq, z * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  ridged2(x, y) {
    const v = 1 - Math.abs(this.fbm2(x, y, 4, 2.1, 0.55));
    return v * v;
  }
}
