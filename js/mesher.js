import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GAME, BLOCKS } from "./config.js";

const faceDefs = [
  { dir: [ 1, 0, 0],  corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], normal: [1,0,0] },
  { dir: [-1, 0, 0],  corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], normal: [-1,0,0] },
  { dir: [ 0, 1, 0],  corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], normal: [0,1,0] },
  { dir: [ 0,-1, 0],  corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], normal: [0,-1,0] },
  { dir: [ 0, 0, 1],  corners: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], normal: [0,0,1] },
  { dir: [ 0, 0,-1],  corners: [[0,1,0],[1,1,0],[1,0,0],[0,0,0]], normal: [0,0,-1] },
];

function tileUV(tile, atlasCols = 8, atlasRows = 8) {
  const size = 1 / atlasCols;
  const x = tile % atlasCols;
  const y = Math.floor(tile / atlasCols);
  const u0 = x * size;
  const v0 = 1 - (y + 1) * size;
  const u1 = u0 + size;
  const v1 = v0 + size;
  return [u0, v0, u1, v1];
}

export function buildChunkMesh(chunk, world) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const size = GAME.chunkSize;
  const height = GAME.worldHeight;

  const pushFace = (x, y, z, faceIndex, blockId) => {
    const def = BLOCKS[blockId];
    if (!def) return;
    const [nx, ny, nz] = faceDefs[faceIndex].normal;
    const tex = Array.isArray(def.texture) ? def.texture[faceIndex] ?? def.texture[0] : def.texture;
    const [u0, v0, u1, v1] = tileUV(tex);

    const base = positions.length / 3;
    const shade = faceIndex === 2 ? 1.0 : faceIndex === 3 ? 0.65 : 0.82;
    const gx = x, gy = y, gz = z;
    const corners = faceDefs[faceIndex].corners;
    const uvPairs = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      positions.push(gx + c[0], gy + c[1], gz + c[2]);
      normals.push(nx, ny, nz);
      uvs.push(...uvPairs[i]);
      colors.push(shade, shade, shade);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const getAt = (wx, wy, wz) => world.getBlock(wx, wy, wz);
  const x0 = chunk.cx * size;
  const z0 = chunk.cz * size;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < height; y++) {
        const id = chunk.data[(y * size + z) * size + x];
        if (id === 0) continue;
        const block = BLOCKS[id];
        if (!block?.solid) continue;
        const wx = x0 + x, wz = z0 + z;
        for (let f = 0; f < 6; f++) {
          const d = faceDefs[f].dir;
          const nb = getAt(wx + d[0], y + d[1], wz + d[2]);
          const ndef = BLOCKS[nb];
          if (!ndef || ndef.transparent || !ndef.solid) {
            pushFace(wx, y, wz, f, id);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
