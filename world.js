import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GAME, BLOCK_IDS, BLOCKS } from "./config.js";
import { Noise } from "./noise.js";
import { buildChunkMesh } from "./mesher.js";

function key(cx, cz) {
  return `${cx},${cz}`;
}

function blockIndex(x, y, z) {
  return (y * GAME.chunkSize + z) * GAME.chunkSize + x;
}

export class World {
  constructor(scene, seed = GAME.seed) {
    this.scene = scene;
    this.seed = seed;
    this.noise = new Noise(seed);
    this.chunks = new Map();
    this.editLog = new Map();
    this.time = 0;
    this.weather = { type: "clear", timer: 0, rainTimer: 0 };
    this.pendingMeshes = new Set();
    this.waterMaterial = null;
  }


  worldToChunk(x, z) {
    return { cx: Math.floor(x / GAME.chunkSize), cz: Math.floor(z / GAME.chunkSize) };
  }

  getChunk(cx, cz) {
    return this.chunks.get(key(cx, cz));
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= GAME.worldHeight) return 0;
    const { cx, cz } = this.worldToChunk(wx, wz);
    const chunk = this.getChunk(cx, cz);
    if (chunk) {
      return chunk.data[blockIndex(((wx % GAME.chunkSize) + GAME.chunkSize) % GAME.chunkSize, wy, ((wz % GAME.chunkSize) + GAME.chunkSize) % GAME.chunkSize)] || 0;
    }
    return this.sampleBlock(wx, wy, wz);
  }

  setBlock(wx, wy, wz, id) {
    if (wy < 0 || wy >= GAME.worldHeight) return;
    const { cx, cz } = this.worldToChunk(wx, wz);
    const chunk = this.ensureChunk(cx, cz);
    const lx = ((wx % GAME.chunkSize) + GAME.chunkSize) % GAME.chunkSize;
    const lz = ((wz % GAME.chunkSize) + GAME.chunkSize) % GAME.chunkSize;
    const idx = blockIndex(lx, wy, lz);
    chunk.data[idx] = id;
    chunk.dirty = true;
    this.editLog.set(`${wx},${wy},${wz}`, id);
    this.markDirtyNeighbors(wx, wz);
  }

  markDirtyNeighbors(wx, wz) {
    const { cx, cz } = this.worldToChunk(wx, wz);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.getChunk(cx + dx, cz + dz);
        if (c) c.dirty = true;
      }
    }
  }

  sampleHeight(wx, wz) {
    const mountain = this.noise.ridged2(wx * 0.012, wz * 0.012) * 18;
    const hills = this.noise.fbm2(wx * 0.025, wz * 0.025, 5, 2.0, 0.5) * 8;
    const base = 22 + mountain + hills;
    const river = Math.abs(this.noise.fbm2(wx * 0.008, wz * 0.008, 3, 2.0, 0.5));
    return Math.floor(base - river * 4);
  }

  sampleBiome(wx, wz) {
    const temp = this.noise.fbm2(wx * 0.004, wz * 0.004, 4, 2, 0.5);
    const moist = this.noise.fbm2((wx + 999) * 0.005, (wz - 777) * 0.005, 4, 2, 0.5);
    return { temp, moist };
  }

  sampleBlock(wx, wy, wz) {
    if (wy < 0 || wy >= GAME.worldHeight) return 0;
    const h = this.sampleHeight(wx, wz);
    const biome = this.sampleBiome(wx, wz);
    const cave = this.noise.fbm3(wx * 0.06, wy * 0.06, wz * 0.06, 3, 2, 0.5);
    const caveThreshold = 0.42 + (wy / GAME.worldHeight) * 0.2;
    const isCave = wy > 8 && wy < h - 2 && Math.abs(cave) > caveThreshold;

    if (wy > h) {
      if (wy <= GAME.waterLevel) return BLOCK_IDS.WATER;
      if (biome.temp < -0.25 && wy <= GAME.waterLevel + 2) return BLOCK_IDS.SNOW;
      return BLOCK_IDS.AIR;
    }
    if (isCave) return BLOCK_IDS.AIR;

    const depth = h - wy;
    if (wy === h) {
      if (h < GAME.waterLevel + 2) return BLOCK_IDS.SAND;
      if (biome.temp < -0.2) return BLOCK_IDS.SNOW;
      if (biome.moist > 0.35) return BLOCK_IDS.GRASS;
      return BLOCK_IDS.GRASS;
    }
    if (depth < 4) {
      if (h < GAME.waterLevel + 2) return BLOCK_IDS.SAND;
      return BLOCK_IDS.DIRT;
    }

    if (depth > 14 && this.noise.fbm2(wx * 0.08, wz * 0.08, 3, 2, 0.5) > 0.48) return BLOCK_IDS.COAL;
    if (depth > 20 && this.noise.fbm2((wx+500) * 0.08, (wz-500) * 0.08, 3, 2, 0.5) > 0.52) return BLOCK_IDS.IRON;
    if (depth > 28 && this.noise.fbm2((wx-800) * 0.08, (wz+800) * 0.08, 3, 2, 0.5) > 0.56) return BLOCK_IDS.RUBY;
    if (depth > 34 && this.noise.fbm2(wx * 0.11, wz * 0.11, 3, 2, 0.5) > 0.62) return BLOCK_IDS.TITANIUM;
    return BLOCK_IDS.STONE;
  }

  generateChunk(cx, cz) {
    const size = GAME.chunkSize;
    const data = new Uint8Array(size * GAME.worldHeight * size);
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const wx = cx * size + x;
        const wz = cz * size + z;
        for (let y = 0; y < GAME.worldHeight; y++) {
          const id = this.sampleBlock(wx, y, wz);
          data[blockIndex(x, y, z)] = id;
        }
        this.decorateColumn(data, x, z, wx, wz);
      }
    }
    const chunk = { cx, cz, data, mesh: null, dirty: true, group: null };
    this.applyEditsToChunk(chunk);
    return chunk;
  }

  applyEditsToChunk(chunk) {
    const size = GAME.chunkSize;
    for (const [k, id] of this.editLog.entries()) {
      const [wx, wy, wz] = k.split(",").map(Number);
      const cx = Math.floor(wx / size), cz = Math.floor(wz / size);
      if (cx !== chunk.cx || cz !== chunk.cz) continue;
      const lx = ((wx % size) + size) % size;
      const lz = ((wz % size) + size) % size;
      if (wy >= 0 && wy < GAME.worldHeight) {
        chunk.data[blockIndex(lx, wy, lz)] = id;
      }
    }
  }

  decorateColumn(data, x, z, wx, wz) {
    const h = this.sampleHeight(wx, wz);
    const biome = this.sampleBiome(wx, wz);
    const top = data[blockIndex(x, h, z)];
    if (top === BLOCK_IDS.GRASS) {
      const treeChance = this.noise.fbm2(wx * 0.13, wz * 0.13, 3, 2, 0.5);
      if (treeChance > 0.62 && h < GAME.worldHeight - 12 && h > 10) {
        this.growTree(data, x, z, h + 1, wx, wz, biome);
      }
    }
  }

  growTree(data, x, z, y, wx, wz, biome) {
    const size = GAME.chunkSize;
    const height = 4 + Math.floor((this.noise.fbm2(wx * 0.2, wz * 0.2, 2, 2, 0.5) + 1) * 2);
    for (let i = 0; i < height; i++) {
      if (y + i >= GAME.worldHeight) break;
      data[blockIndex(x, y + i, z)] = BLOCK_IDS.LOG;
    }
    const top = y + height;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 1; dy++) {
          const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (dist <= 4) {
            const lx = x + dx, lz = z + dz, ly = top + dy;
            if (lx >= 0 && lx < size && lz >= 0 && lz < size && ly < GAME.worldHeight) {
              const idx = blockIndex(lx, ly, lz);
              if (data[idx] === 0 || data[idx] === BLOCK_IDS.WATER) data[idx] = BLOCK_IDS.LEAVES;
            }
          }
        }
      }
    }
  }

  ensureChunk(cx, cz) {
    const k = key(cx, cz);
    let chunk = this.chunks.get(k);
    if (!chunk) {
      chunk = this.generateChunk(cx, cz);
      this.chunks.set(k, chunk);
    }
    return chunk;
  }

  updateVisibleChunks(playerPos) {
    const cx = Math.floor(playerPos.x / GAME.chunkSize);
    const cz = Math.floor(playerPos.z / GAME.chunkSize);
    const needed = new Set();
    for (let dz = -GAME.renderDistance; dz <= GAME.renderDistance; dz++) {
      for (let dx = -GAME.renderDistance; dx <= GAME.renderDistance; dx++) {
        const ncx = cx + dx, ncz = cz + dz;
        const k = key(ncx, ncz);
        needed.add(k);
        const chunk = this.ensureChunk(ncx, ncz);
        if (chunk.dirty) this.rebuildChunk(chunk);
      }
    }

    for (const [k, chunk] of this.chunks.entries()) {
      if (!needed.has(k)) {
        const dist = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz));
        if (dist > GAME.unloadDistance) {
          this.disposeChunk(chunk);
          this.chunks.delete(k);
        }
      }
    }
  }

  rebuildChunk(chunk) {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    const geometry = buildChunkMesh(chunk, this);
    const mesh = new THREE.Mesh(geometry, this.chunkMaterial);
    mesh.frustumCulled = true;
    mesh.position.set(0, 0, 0);
    chunk.mesh = mesh;
    chunk.dirty = false;
    const existing = chunk.group;
    if (existing) this.scene.remove(existing);
    this.scene.add(mesh);
    chunk.group = mesh;
  }

  disposeChunk(chunk) {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
      chunk.group = null;
    }
  }

  applyAtlas(texture) {
    this.atlasTexture = texture;
    this.chunkMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
      alphaTest: 0.12
    });
  }

  update(dt) {
    this.time += dt;
    const weatherCycle = Math.sin(this.time * 0.015);
    if (weatherCycle > 0.7) {
      this.weather.type = "rain";
    } else if (weatherCycle < -0.78) {
      this.weather.type = "storm";
    } else {
      this.weather.type = "clear";
    }
  }

  exportSave() {
    const edits = Array.from(this.editLog.entries());
    return {
      seed: this.seed,
      time: this.time,
      weather: this.weather,
      edits,
    };
  }

  importSave(data) {
    if (!data) return;
    if (Array.isArray(data.edits)) {
      for (const [k, id] of data.edits) this.editLog.set(k, id);
    }
    if (typeof data.time === "number") this.time = data.time;
    if (data.weather) this.weather = data.weather;
  }
}
