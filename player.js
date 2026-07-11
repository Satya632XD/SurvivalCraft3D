import { GAME, BLOCK_IDS, BLOCKS } from "./config.js";

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class Player {
  constructor() {
    this.position = { x: 0, y: 40, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.health = GAME.maxHealth;
    this.hunger = GAME.maxHunger;
    this.hungerAccumulator = 0;
    this.selectedBlock = BLOCK_IDS.GRASS;
    this.isDead = false;
    this.fallStartY = this.position.y;
    this.toolTier = 0;
  }

  respawn(world) {
    const spawnY = world.sampleHeight(0, 0) + 4;
    this.position = { x: 0, y: spawnY, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.health = GAME.maxHealth;
    this.hunger = GAME.maxHunger;
    this.isDead = false;
  }

  setSelectedBlock(id) {
    this.selectedBlock = id;
  }

  cameraDirection() {
    const cp = Math.cos(this.pitch);
    return {
      x: Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: Math.cos(this.yaw) * cp,
    };
  }

  aabbAt(x, y, z) {
    const r = GAME.playerRadius;
    return { minX: x - r, maxX: x + r, minY: y, maxY: y + GAME.playerHeight, minZ: z - r, maxZ: z + r };
  }

  collides(world, x, y, z) {
    const box = this.aabbAt(x, y, z);
    const minX = Math.floor(box.minX), maxX = Math.floor(box.maxX);
    const minY = Math.floor(box.minY), maxY = Math.floor(box.maxY);
    const minZ = Math.floor(box.minZ), maxZ = Math.floor(box.maxZ);
    for (let wy = minY; wy <= maxY; wy++) {
      for (let wz = minZ; wz <= maxZ; wz++) {
        for (let wx = minX; wx <= maxX; wx++) {
          const id = world.getBlock(wx, wy, wz);
          if (BLOCKS[id]?.solid) return true;
        }
      }
    }
    return false;
  }

  moveAxis(world, axis, amount) {
    const pos = { ...this.position };
    pos[axis] += amount;
    if (!this.collides(world, pos.x, pos.y, pos.z)) {
      this.position = pos;
      return false;
    }
    const step = Math.sign(amount) * 0.05;
    let moved = 0;
    while (Math.abs(moved) < Math.abs(amount)) {
      const next = moved + step;
      const test = { ...this.position };
      test[axis] += next;
      if (this.collides(world, test.x, test.y, test.z)) break;
      moved = next;
    }
    this.position[axis] += moved;
    return true;
  }

  update(dt, world, input) {
    if (this.isDead) return;
    const move = { x: 0, z: 0 };
    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    const j = input.joystick || { x: 0, y: 0, active: false };
    const joystickForward = j.active ? -j.y : 0;
    const joystickStrafe = j.active ? j.x : 0;

    move.x += (input.right ? 1 : 0) - (input.left ? 1 : 0) + joystickStrafe;
    move.z += (input.back ? 1 : 0) - (input.forward ? 1 : 0) + joystickForward;

    const len = Math.hypot(move.x, move.z);
    let speed = GAME.walkSpeed;
    if (input.sprint && this.hunger > 2) speed = GAME.sprintSpeed;
    if (input.sneak) speed = GAME.sneakSpeed;
    if (len > 0.01) {
      move.x /= len;
      move.z /= len;
      const mx = (move.x * rightX + move.z * forwardX) * speed;
      const mz = (move.x * rightZ + move.z * forwardZ) * speed;
      this.velocity.x += (mx - this.velocity.x) * Math.min(1, dt * 10);
      this.velocity.z += (mz - this.velocity.z) * Math.min(1, dt * 10);
    } else {
      this.velocity.x *= Math.max(0, 1 - dt * 8);
      this.velocity.z *= Math.max(0, 1 - dt * 8);
    }

    if (input.jump && this.onGround) {
      this.velocity.y = GAME.jumpVelocity;
      this.onGround = false;
      this.hunger = Math.max(0, this.hunger - 0.08);
      this.fallStartY = this.position.y;
    }

    this.velocity.y -= GAME.gravity * dt;

    this.moveAxis(world, "x", this.velocity.x * dt);
    this.moveAxis(world, "z", this.velocity.z * dt);

    const falling = this.velocity.y < 0;
    const collidedY = this.moveAxis(world, "y", this.velocity.y * dt);
    if (collidedY && falling) {
      if (!this.onGround) {
        const fall = Math.max(0, this.fallStartY - this.position.y);
        if (fall > 4.5) {
          const dmg = Math.min(8, Math.floor((fall - 4.5) * 1.5));
          this.damage(dmg);
        }
      }
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      if (this.onGround) this.fallStartY = this.position.y;
      this.onGround = false;
    }

    if (Math.abs(this.velocity.x) + Math.abs(this.velocity.z) > 0.25) {
      const drain = (input.sprint ? 0.03 : 0.012) + (input.sneak ? 0.004 : 0);
      this.hunger = Math.max(0, this.hunger - drain * dt * 60);
    }
    if (Math.abs(this.velocity.x) + Math.abs(this.velocity.z) > 0.6) {
      this.hunger = Math.max(0, this.hunger - 0.01 * dt * 60);
    }

    if (this.hunger >= GAME.maxHunger) {
      this.hungerAccumulator += dt;
      if (this.hungerAccumulator > 2) {
        this.health = Math.min(GAME.maxHealth, this.health + dt * 0.5);
      }
    } else {
      this.hungerAccumulator = 0;
    }

    if (this.position.y < -10) {
      this.damage(2);
      this.position.y = 30;
      this.velocity.y = 0;
    }
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }
}
