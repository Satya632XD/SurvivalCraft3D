export class Inventory {
  constructor(size = 36) {
    this.slots = Array.from({ length: size }, () => ({ id: 0, count: 0 }));
    this.cursor = { id: 0, count: 0 };
    this.selected = 0;
    this.open = false;
  }

  cloneSlot(slot) {
    return { id: slot.id, count: slot.count };
  }

  addItem(id, count = 1) {
    for (const slot of this.slots) {
      if (slot.id === id && slot.count < 99) {
        const add = Math.min(99 - slot.count, count);
        slot.count += add;
        count -= add;
        if (count <= 0) return true;
      }
    }
    for (const slot of this.slots) {
      if (slot.id === 0) {
        const add = Math.min(99, count);
        slot.id = id;
        slot.count = add;
        count -= add;
        if (count <= 0) return true;
      }
    }
    return count <= 0;
  }

  removeItem(id, count = 1) {
    let need = count;
    for (const slot of this.slots) {
      if (slot.id === id) {
        const take = Math.min(slot.count, need);
        slot.count -= take;
        need -= take;
        if (slot.count <= 0) { slot.id = 0; slot.count = 0; }
        if (need <= 0) return true;
      }
    }
    return false;
  }

  setHotbar(index, slot) {
    this.slots[index] = { id: slot.id, count: slot.count };
  }

  serialize() {
    return JSON.stringify({
      slots: this.slots,
      selected: this.selected,
    });
  }

  deserialize(text) {
    try {
      const data = JSON.parse(text);
      if (Array.isArray(data.slots)) {
        this.slots = data.slots.map(s => ({ id: s.id | 0, count: s.count | 0 }));
      }
      this.selected = data.selected | 0;
    } catch {}
  }
}
