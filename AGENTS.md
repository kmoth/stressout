# AGENTS.md

Guidance for future agents working in this repository.

## Project Overview

Breakoutoutout is a browser game built with Vite and strict TypeScript. It combines:

- Three.js WebGPU rendering for the main 3D board, camera, CRT post-processing, and visual effects.
- PixiJS for the overlay HUD.
- Rapier 3D for deterministic-ish board physics.
- Howler for generated in-memory sound effects.

The game is launched from `src/main.ts`, which mounts `BreakoutGame` into `#app`. Add `?autopilot=true` to the URL to run the game without player input.

## Commands

- Install dependencies: `npm install`
- Start the local dev server: `npm run dev`
- Production/type-check build: `npm run build`
- Preview built output: `npm run preview`

There is no test suite currently. Use `npm run build` as the baseline validation after code changes. For rendering or input changes, also run the app locally and verify it in a browser.

When working with the dev server, use this project's default `npm run dev` server on its configured host/port. Do not start extra dev servers on alternate ports. If the default server is stale, stuck, or needs new code loaded, stop/kill that existing process and restart it with `npm run dev`.

## Source Layout

- `src/main.ts`: app bootstrapping, root lookup, URL flag parsing, and startup error fallback.
- `src/style.css`: full-screen shell styling, canvas layering, and startup error styles.
- `src/game/BreakoutGame.ts`: browser-facing game orchestration. Owns Three.js, PixiJS HUD, input, camera, multi-plane visual arrangement, sound dispatch, render loop, and synchronization from simulation snapshots to meshes.
- `src/game/BreakoutoutoutInstance.ts`: gameplay simulation. Owns Rapier world setup, paddle/ball/bricks, rules, score/lives/level state, splitter realities, autopilot/life bricks, collision resolution, and serializable snapshots.
- `src/game/sound.ts`: generated WAV tone bank wrapped in Howler.
- `src/types/three-nebula.d.ts`: local typing shim for `three-nebula`.

## Architecture Notes

- Keep simulation rules in `BreakoutoutoutInstance.ts`. Rendering, HUD, camera, and browser input should stay in `BreakoutGame.ts`.
- Use snapshots/events as the boundary between simulation and presentation. `BreakoutoutoutInstance.step()` returns `BreakoutoutoutEvent[]`; `BreakoutGame` interprets those events for sound, visual sync, and reality splitting.
- The fixed simulation timestep is `FIXED_STEP` (`1 / 90`). Avoid making gameplay depend directly on variable frame delta.
- Coordinates are board-local with X horizontal, Y vertical, and Z used only for render depth. Rapier bodies are kept planar.
- Bricks are data-first snapshots. If adding brick types, update `BrickKind`, scoring/color helpers, sound mapping, mesh appearance, and any snapshot cloning/split behavior together.
- Splitter bricks intentionally clone a snapshot into a new game plane. Changes to snapshot shape must preserve `createSplitRealitySnapshot()` behavior.
- The selected plane receives keyboard/touch input. Background planes continue to simulate, render dimmed, and affect global ball-speed scaling.

## Gameplay Controls

- Left/right movement: `ArrowLeft` / `ArrowRight`.
- Launch: `Space` or `Enter`.
- Restart selected active plane: `R`.
- Switch selected reality plane: `ArrowUp` / `ArrowDown`.
- Touch/pen: drag controls paddle position; vertical swipe switches plane; tap/release launches.

## Development Guardrails

- This repo uses `strict`, `noUnusedLocals`, and `noUnusedParameters`; keep TypeScript clean.
- Prefer small, explicit constants near the top of the owning module for gameplay tuning.
- Dispose removed Three.js meshes/materials with the existing cleanup helpers when changing render object lifecycles.
- Be careful with browser APIs that require user gestures, especially audio. Sound is generated and preloaded through `SoundBank`.
- Keep the HUD in PixiJS unless the task explicitly changes the rendering architecture.
- For frontend changes, verify both desktop and narrow/mobile viewport behavior. The game shell is fixed full-screen and should not scroll.
- Avoid introducing server-side assumptions; the app is static Vite output.
