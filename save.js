export class SaveSystem {
  constructor(key = "stonefall_frontier_save") {
    this.key = key;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  save(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  clear() {
    localStorage.removeItem(this.key);
  }
}
