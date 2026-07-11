# Stonefall Frontier

A Luanti-inspired voxel survival prototype built for the browser.

## What this is

This project takes inspiration from Luanti's strongest ideas:
- modular code structure
- chunked infinite voxel terrain
- original textures and art direction
- browser-friendly controls
- save/load support
- a foundation that can grow into bigger systems

This is **not** Luanti and does **not** copy Luanti code or assets.

## Run it

Open `index.html` in a modern browser.

Because it uses ES modules from a CDN, it needs:
- internet access for Three.js CDN modules
- a browser that supports WebGL and ES modules

If your browser blocks direct file opening, serve the folder with any simple static server.

## Included features

- Procedural terrain with biomes
- Chunk loading and unloading
- Original generated texture atlas
- First-person movement
- Desktop and mobile input
- Mining and block placement
- Local save system
- Health and hunger HUD
- Day/night cycle
- Weather states
- Basic inventory

## Folder structure

- `index.html` — entry point
- `style.css` — HUD and mobile UI styling
- `assets/atlas.png` — generated texture atlas
- `js/config.js` — game constants and block definitions
- `js/noise.js` — seedable noise
- `js/atlas.js` — texture loader
- `js/controls.js` — desktop/mobile input
- `js/inventory.js` — inventory state
- `js/save.js` — localStorage save manager
- `js/mesher.js` — chunk mesh builder
- `js/world.js` — world generation and chunk management
- `js/player.js` — player physics and survival stats
- `js/ui.js` — HUD and inventory UI
- `js/main.js` — app bootstrap and loop

## Design notes

The goal was to echo the qualities that make Luanti feel strong:
- data-driven world generation
- systems separated into small modules
- a readable codebase that can be extended
- a clean base for future crafting, mobs, NPCs, boats, farming, and mod support

## Next upgrades

Good follow-up additions would be:
- crafting recipes and tool progression
- enemies and animals
- caves with ore veins and structures
- water physics and swimming
- better chunk meshing
- resource packs / mod loading
- multiplayer-ready networking
