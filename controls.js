export class Controls {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pointerLocked = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.pendingJump = false;
    this.inventoryToggle = false;
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.mobile = matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.touchMoveId = null;
    this.touchLookId = null;
    this.touchStart = { x: 0, y: 0, t: 0 };

    window.addEventListener("keydown", e => {
      this.keys.add(e.code);
      if (e.code === "Space") this.pendingJump = true;
      if (e.code === "KeyE") this.inventoryToggle = true;
    });
    window.addEventListener("keyup", e => this.keys.delete(e.code));

    canvas.addEventListener("click", () => {
      if (!this.mobile && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    window.addEventListener("mousemove", e => {
      if (this.pointerLocked) {
        this.lookDeltaX += e.movementX || 0;
        this.lookDeltaY += e.movementY || 0;
      }
    });

    const prevent = e => { e.preventDefault(); };
    canvas.addEventListener("contextmenu", prevent);
    canvas.addEventListener("mousedown", e => {
      if (e.button === 0) this.mouseDownLeft = true;
      if (e.button === 2) this.mouseDownRight = true;
    });
    window.addEventListener("mouseup", e => {
      if (e.button === 0) this.mouseDownLeft = false;
      if (e.button === 2) this.mouseDownRight = false;
    });

    this.mobileButtons = {};
    this._setupTouchUI();
  }

  _setupTouchUI() {
    const byId = id => document.getElementById(id);
    const bindHold = (id, flag) => {
      const el = byId(id);
      if (!el) return;
      const set = v => { this.mobileButtons[flag] = v; };
      el.addEventListener("touchstart", e => { e.preventDefault(); set(true); }, { passive: false });
      el.addEventListener("touchend", e => { e.preventDefault(); set(false); }, { passive: false });
      el.addEventListener("touchcancel", e => { e.preventDefault(); set(false); }, { passive: false });
      el.addEventListener("mousedown", e => { e.preventDefault(); set(true); });
      window.addEventListener("mouseup", () => set(false));
    };
    bindHold("btnJump", "jump");
    bindHold("btnSprint", "sprint");
    bindHold("btnSneak", "sneak");
    bindHold("btnBreak", "break");
    bindHold("btnPlace", "place");

    const inv = byId("btnInventory");
    if (inv) {
      const toggle = e => { e.preventDefault(); this.inventoryToggle = true; };
      inv.addEventListener("touchstart", toggle, { passive: false });
      inv.addEventListener("mousedown", toggle);
    }

    const pad = byId("leftPad");
    if (pad) {
      const area = pad.getBoundingClientRect();
      const center = { x: area.left + area.width / 2, y: area.top + area.height / 2 };
      const joystick = { x: 0, y: 0, active: false, id: null };
      const updateStick = (clientX, clientY) => {
        const dx = clientX - center.x;
        const dy = clientY - center.y;
        const max = 42;
        const nx = Math.max(-1, Math.min(1, dx / max));
        const ny = Math.max(-1, Math.min(1, dy / max));
        joystick.x = nx;
        joystick.y = ny;
        pad.style.setProperty("--jx", `${nx * 22}px`);
        pad.style.setProperty("--jy", `${ny * 22}px`);
      };
      const resetStick = () => {
        joystick.x = 0; joystick.y = 0; joystick.active = false; joystick.id = null;
        pad.style.setProperty("--jx", `0px`);
        pad.style.setProperty("--jy", `0px`);
      };
      window.addEventListener("touchstart", e => {
        for (const t of e.changedTouches) {
          if (joystick.id == null && t.clientX < window.innerWidth * 0.45) {
            joystick.id = t.identifier;
            joystick.active = true;
            updateStick(t.clientX, t.clientY);
          }
        }
      }, { passive: false });
      window.addEventListener("touchmove", e => {
        for (const t of e.changedTouches) {
          if (t.identifier === joystick.id && joystick.active) {
            updateStick(t.clientX, t.clientY);
          } else if (t.identifier === this.touchLookId) {
            const dx = t.clientX - this.touchStart.x;
            const dy = t.clientY - this.touchStart.y;
            this.lookDeltaX += dx * 0.22;
            this.lookDeltaY += dy * 0.22;
            this.touchStart.x = t.clientX;
            this.touchStart.y = t.clientY;
          }
        }
      }, { passive: false });
      window.addEventListener("touchend", e => {
        for (const t of e.changedTouches) {
          if (t.identifier === joystick.id) resetStick();
          if (t.identifier === this.touchLookId) this.touchLookId = null;
        }
      }, { passive: false });
      window.addEventListener("touchcancel", resetStick, { passive: false });
      this.joystick = joystick;
      this.getJoystick = () => joystick;
    }

    window.addEventListener("touchstart", e => {
      for (const t of e.changedTouches) {
        if (this.touchLookId == null && t.clientX > window.innerWidth * 0.45) {
          this.touchLookId = t.identifier;
          this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
        }
      }
    }, { passive: false });
  }

  beginFrame() {
    const out = {
      left: this.keys.has("KeyA") || this.keys.has("ArrowLeft"),
      right: this.keys.has("KeyD") || this.keys.has("ArrowRight"),
      forward: this.keys.has("KeyW") || this.keys.has("ArrowUp"),
      back: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      jump: this.pendingJump || this.keys.has("Space") || !!this.mobileButtons.jump,
      sprint: this.keys.has("ControlLeft") || this.keys.has("ControlRight") || !!this.mobileButtons.sprint,
      sneak: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || !!this.mobileButtons.sneak,
      mine: this.mouseDownLeft || !!this.mobileButtons.break,
      place: this.mouseDownRight || !!this.mobileButtons.place,
      useInventory: this.inventoryToggle,
      lookX: this.lookDeltaX,
      lookY: this.lookDeltaY,
      joystick: this.getJoystick ? this.getJoystick() : { x: 0, y: 0, active: false },
    };
    this.pendingJump = false;
    this.inventoryToggle = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return out;
  }
}
