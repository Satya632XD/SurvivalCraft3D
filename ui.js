import { GAME, BLOCKS } from "./config.js";

export class UI {
  constructor(inventory) {
    this.inventory = inventory;
    this.root = document.getElementById("ui");
    this.hotbar = document.getElementById("hotbar");
    this.inventoryPanel = document.getElementById("inventoryPanel");
    this.tooltip = document.getElementById("tooltip");
    this.health = document.getElementById("health");
    this.hunger = document.getElementById("hunger");
    this.daytime = document.getElementById("daytime");
    this.weather = document.getElementById("weather");
    this.coords = document.getElementById("coords");
    this.info = document.getElementById("info");
    this.crosshair = document.getElementById("crosshair");
    this.highlight = document.getElementById("highlight");
    this.dragging = null;
    this._buildHotbar();
    this._buildInventoryGrid();
  }

  _buildHotbar() {
    this.hotbar.innerHTML = "";
    this.hotbarSlots = [];
    for (let i = 0; i < 9; i++) {
      const el = document.createElement("button");
      el.className = "slot";
      el.dataset.index = i;
      el.addEventListener("click", () => {
        this.inventory.selected = i;
      });
      this.hotbar.appendChild(el);
      this.hotbarSlots.push(el);
    }
  }

  _buildInventoryGrid() {
    this.inventoryPanel.innerHTML = "";
    this.gridSlots = [];
    for (let i = 0; i < this.inventory.slots.length; i++) {
      const el = document.createElement("button");
      el.className = "slot grid";
      el.dataset.index = i;
      el.addEventListener("click", () => {
        const slot = this.inventory.slots[i];
        if (this.inventory.cursor.id === 0 && slot.id !== 0) {
          this.inventory.cursor = { ...slot };
          this.inventory.slots[i] = { id: 0, count: 0 };
        } else if (this.inventory.cursor.id !== 0 && slot.id === 0) {
          this.inventory.slots[i] = { ...this.inventory.cursor };
          this.inventory.cursor = { id: 0, count: 0 };
        } else if (this.inventory.cursor.id !== 0 && slot.id !== 0) {
          const temp = { ...slot };
          this.inventory.slots[i] = { ...this.inventory.cursor };
          this.inventory.cursor = temp;
        }
      });
      this.inventoryPanel.appendChild(el);
      this.gridSlots.push(el);
    }
  }

  setInventoryOpen(open) {
    this.inventory.open = open;
    this.inventoryPanel.classList.toggle("open", open);
    this.crosshair.style.display = open ? "none" : "block";
  }

  update(player, world, target, miningProgress) {
    this.health.textContent = "♥".repeat(Math.ceil(player.health)) + "·".repeat(GAME.maxHealth - Math.ceil(player.health));
    this.hunger.textContent = "🍗".repeat(Math.ceil(player.hunger)) + "·".repeat(GAME.maxHunger - Math.ceil(player.hunger));
    this.coords.textContent = `X ${player.position.x.toFixed(1)} Y ${player.position.y.toFixed(1)} Z ${player.position.z.toFixed(1)}`;
    const day = (world.time % GAME.dayLengthSeconds) / GAME.dayLengthSeconds;
    const timeText = day < 0.25 ? "Morning" : day < 0.5 ? "Day" : day < 0.75 ? "Sunset" : "Night";
    this.daytime.textContent = `${timeText} ${(day * 24).toFixed(1)}h`;
    this.weather.textContent = world.weather.type === "clear" ? "Clear" : world.weather.type === "rain" ? "Rain" : "Storm";
    if (target) {
      const b = BLOCKS[target.id];
      this.info.textContent = `${b?.name ?? "Block"}${miningProgress > 0 ? `  ${Math.floor(miningProgress * 100)}%` : ""}`;
    } else {
      this.info.textContent = "Look at a block to mine";
    }

    for (let i = 0; i < 9; i++) {
      this.renderSlot(this.hotbarSlots[i], this.inventory.slots[i], i === this.inventory.selected);
    }
    for (let i = 9; i < this.inventory.slots.length; i++) {
      this.renderSlot(this.gridSlots[i], this.inventory.slots[i], false);
    }
    this.tooltip.textContent = this.inventory.cursor.id ? `Carrying: ${BLOCKS[this.inventory.cursor.id]?.name ?? "Item"} ×${this.inventory.cursor.count}` : "";
  }

  renderSlot(el, slot, active) {
    el.classList.toggle("active", active);
    el.innerHTML = "";
    if (!slot || slot.id === 0) return;
    const item = BLOCKS[slot.id];
    el.innerHTML = `<span class="icon">${item?.name?.[0] ?? "?"}</span><span class="count">${slot.count}</span>`;
    el.title = item?.name ?? "Item";
  }

  setHighlight(box) {
    if (!box) {
      this.highlight.style.display = "none";
      return;
    }
    this.highlight.style.display = "block";
    this.highlight.style.transform = `translate3d(${box.x}px, ${box.y}px, 0) scale(${box.w}, ${box.h})`;
  }
}
