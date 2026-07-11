import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { loadAtlasTexture } from "./atlas.js";
import { GAME, BLOCK_IDS, BLOCKS } from "./config.js";
import { World } from "./world.js";
import { Player } from "./player.js";
import { Controls } from "./controls.js";
import { Inventory } from "./inventory.js";
import { SaveSystem } from "./save.js";
import { UI } from "./ui.js";

const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9cc9ff, 0.0021);
scene.background = new THREE.Color(0x8db8ff);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 900);
const ambient = new THREE.HemisphereLight(0xb9dbff, 0x3d2f1b, 1.6);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.8);
sun.position.set(100, 180, 80);
scene.add(sun);

const atlas = loadAtlasTexture("./assets/atlas.png");
const controls = new Controls(canvas);
const inventory = new Inventory(36);
const save = new SaveSystem();
const world = new World(scene, GAME.seed);
const player = new Player();
const ui = new UI(inventory);
world.applyAtlas(atlas);

inventory.addItem(BLOCK_IDS.GRASS, 64);
inventory.addItem(BLOCK_IDS.DIRT, 48);
inventory.addItem(BLOCK_IDS.STONE, 40);
inventory.addItem(BLOCK_IDS.LOG, 20);
inventory.addItem(BLOCK_IDS.SAND, 20);
inventory.addItem(BLOCK_IDS.SNOW, 16);

const highlight = new THREE.Mesh(
  new THREE.BoxGeometry(1.01, 1.01, 1.01),
  new THREE.MeshBasicMaterial({ color: 0xffff88, wireframe: true })
);
highlight.visible = false;
scene.add(highlight);

const skyPlane = new THREE.Mesh(
  new THREE.SphereGeometry(450, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0x7fa7ff, side: THREE.BackSide })
);
scene.add(skyPlane);

const targetData = { hit: false, x: 0, y: 0, z: 0, id: 0 };
let miningProgress = 0;
let miningTarget = null;
let lastSave = 0;
let inventoryOpen = false;
let lastFrame = performance.now();

function formatBlockTarget(hit) {
  if (!hit.hit) return null;
  return { x: hit.x, y: hit.y, z: hit.z, id: hit.id };
}

function raycastBlocks(origin, direction, maxDist = 7.5) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = direction.x > 0 ? 1 : -1;
  const stepY = direction.y > 0 ? 1 : -1;
  const stepZ = direction.z > 0 ? 1 : -1;

  const tDeltaX = direction.x === 0 ? Infinity : Math.abs(1 / direction.x);
  const tDeltaY = direction.y === 0 ? Infinity : Math.abs(1 / direction.y);
  const tDeltaZ = direction.z === 0 ? Infinity : Math.abs(1 / direction.z);

  const frac = (v) => v - Math.floor(v);
  let tMaxX = direction.x === 0 ? Infinity : (direction.x > 0 ? (1 - frac(origin.x)) : frac(origin.x)) / Math.abs(direction.x);
  let tMaxY = direction.y === 0 ? Infinity : (direction.y > 0 ? (1 - frac(origin.y)) : frac(origin.y)) / Math.abs(direction.y);
  let tMaxZ = direction.z === 0 ? Infinity : (direction.z > 0 ? (1 - frac(origin.z)) : frac(origin.z)) / Math.abs(direction.z);

  let t = 0;
  for (let i = 0; i < 96 && t <= maxDist; i++) {
    const id = world.getBlock(x, y, z);
    if (id && BLOCKS[id]?.solid) return { hit: true, x, y, z, id };
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; }
    } else {
      if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; }
    }
  }
  return { hit: false };
}

function tryPlaceBlock(target, blockId) {
  if (!target) return false;
  const dir = player.cameraDirection();
  const bx = target.x + (Math.abs(dir.x) > Math.abs(dir.z) ? Math.sign(dir.x) : 0);
  const by = target.y + (dir.y > 0.35 ? 1 : (dir.y < -0.35 ? -1 : 0));
  const bz = target.z + (Math.abs(dir.z) >= Math.abs(dir.x) ? Math.sign(dir.z) : 0);
  if (world.getBlock(bx, by, bz) !== 0) return false;
  world.setBlock(bx, by, bz, blockId);
  return true;
}

function updateCamera() {
  const dir = player.cameraDirection();
  camera.position.set(player.position.x + 0.5, player.position.y + 1.6, player.position.z + 0.5);
  camera.rotation.order = "YXZ";
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
  const lookTarget = new THREE.Vector3(camera.position.x + dir.x, camera.position.y + dir.y, camera.position.z + dir.z);
  camera.lookAt(lookTarget);
}

function updateHighlight(hit) {
  if (!hit.hit) {
    highlight.visible = false;
    ui.setHighlight(null);
    return;
  }
  highlight.visible = true;
  highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  ui.setHighlight({ x: 0, y: 0, w: 1, h: 1 });
}

function loadGame() {
  const data = save.load();
  if (data) {
    world.importSave(data.world);
    if (data.player) {
      player.position = data.player.position;
      player.velocity = data.player.velocity;
      player.yaw = data.player.yaw;
      player.pitch = data.player.pitch;
      player.health = data.player.health;
      player.hunger = data.player.hunger;
    } else {
      player.respawn(world);
    }
    if (data.inventory) inventory.deserialize(data.inventory);
  } else {
    player.respawn(world);
  }
  world.updateVisibleChunks(player.position);
}

function saveGame() {
  save.save({
    player: {
      position: player.position,
      velocity: player.velocity,
      yaw: player.yaw,
      pitch: player.pitch,
      health: player.health,
      hunger: player.hunger,
    },
    inventory: inventory.serialize(),
    world: world.exportSave(),
  });
}

function setInventoryVisible(visible) {
  inventoryOpen = visible;
  ui.setInventoryOpen(visible);
}

document.getElementById("btnCloseInventory").addEventListener("click", () => setInventoryVisible(false));
document.getElementById("btnCraftDemo").addEventListener("click", () => {
  inventory.addItem(BLOCK_IDS.STONE, 8);
  inventory.addItem(BLOCK_IDS.LOG, 8);
});

canvas.addEventListener("dblclick", () => {
  if (!controls.mobile && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});

canvas.addEventListener("mousedown", e => {
  if (inventoryOpen) return;
  if (e.button === 0) controls.mouseDownLeft = true;
  if (e.button === 2) controls.mouseDownRight = true;
});

window.addEventListener("mouseup", e => {
  if (e.button === 0) controls.mouseDownLeft = false;
  if (e.button === 2) controls.mouseDownRight = false;
});

function processInput(input, dt) {
  player.yaw -= input.lookX * 0.0022;
  player.pitch -= input.lookY * 0.0019;
  player.pitch = Math.max(-1.52, Math.min(1.52, player.pitch));
  if (input.useInventory) setInventoryVisible(!inventoryOpen);
}

function tick(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const input = controls.beginFrame();
  processInput(input, dt);
  if (!inventoryOpen) {
    player.update(dt, world, input);
  }
  world.update(dt);
  world.updateVisibleChunks(player.position);
  updateCamera();

  const dir = player.cameraDirection();
  const origin = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  };
  const hit = raycastBlocks(origin, dir, 7.5);
  targetData.hit = hit.hit;
  if (hit.hit) {
    targetData.x = hit.x;
    targetData.y = hit.y;
    targetData.z = hit.z;
    targetData.id = hit.id;
  }
  updateHighlight(hit);

  if (!inventoryOpen && input.mine && hit.hit) {
    if (!miningTarget || miningTarget.x !== hit.x || miningTarget.y !== hit.y || miningTarget.z !== hit.z) {
      miningTarget = { x: hit.x, y: hit.y, z: hit.z, id: hit.id };
      miningProgress = 0;
    }
    miningProgress += dt / 0.55;
    if (miningProgress >= 1) {
      world.setBlock(hit.x, hit.y, hit.z, 0);
      inventory.addItem(hit.id, 1);
      miningProgress = 0;
      miningTarget = null;
    }
  } else {
    miningProgress = 0;
    miningTarget = null;
  }

  if (!inventoryOpen && input.place && hit.hit) {
    const slot = inventory.slots[inventory.selected];
    const blockId = slot?.id || 0;
    if (blockId && tryPlaceBlock(hit, blockId)) {
      slot.count -= 1;
      if (slot.count <= 0) inventory.slots[inventory.selected] = { id: 0, count: 0 };
    }
  }

  if (player.hunger < 0) player.hunger = 0;
  if (player.health <= 0) {
    document.getElementById("death").classList.add("show");
    player.isDead = true;
  } else {
    document.getElementById("death").classList.remove("show");
  }

  ui.update(player, world, targetData, miningProgress);

  if (now - lastSave > 15000) {
    saveGame();
    lastSave = now;
  }

  const time = (world.time % GAME.dayLengthSeconds) / GAME.dayLengthSeconds;
  const sunAngle = time * Math.PI * 2;
  sun.position.set(Math.cos(sunAngle) * 150, Math.sin(sunAngle) * 150, 90);
  const lightFactor = Math.max(0.22, Math.sin(sunAngle) * 0.65 + 0.4);
  sun.intensity = 1.4 + lightFactor * 2.0;
  ambient.intensity = 0.7 + lightFactor * 0.8;
  scene.fog.density = 0.0016 + (1 - lightFactor) * 0.0013;
  scene.background.setHSL(0.58, 0.52, 0.6 + lightFactor * 0.18);
  skyPlane.material.color.setHSL(0.58, 0.5, 0.55 + lightFactor * 0.15);

  if (world.weather.type !== "clear") {
    scene.fog.density += world.weather.type === "storm" ? 0.0025 : 0.0012;
    ambient.intensity *= world.weather.type === "storm" ? 0.75 : 0.85;
    sun.intensity *= world.weather.type === "storm" ? 0.7 : 0.85;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

loadGame();
requestAnimationFrame(tick);

document.getElementById("btnSave").addEventListener("click", saveGame);
document.getElementById("btnReset").addEventListener("click", () => {
  save.clear();
  location.reload();
});
document.getElementById("btnResume").addEventListener("click", () => setInventoryVisible(false));
