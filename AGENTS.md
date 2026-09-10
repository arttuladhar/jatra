# AGENTS.md

This repo is a small browser game prototype built with vanilla ES modules, Three.js, and Cannon-es. The goal is to keep the code easy to follow and to preserve the workshop-to-procession gameplay loop.

## Project purpose

- Build and tune a Newari chariot builder/editor in `builder.js`.
- Simulate the procession in `physics.js` and `teams.js`.
- Keep the route, controls, and HUD logic separate and readable.
- Avoid introducing framework dependencies or a large build system.

## Essential files

- [README.md](README.md): gameplay behavior, controls, tuning notes, and architecture summary.
- [index.html](index.html): app shell and overlay HTML.
- [main.js](main.js): scene setup, camera, render loop, HUD, and phase transitions.
- [builder.js](builder.js): procedural 3D chariot pieces and construction variants.
- [physics.js](physics.js): Cannon-es world, constraints, fracture logic, and force handling.
- [route.js](route.js): route polyline, checkpoints, buildings, and street collisions.
- [controls.js](controls.js): key-state handling and workshop actions.
- [teams.js](teams.js): pulling team animation and effort-driven motion.
- [sound.js](sound.js): sequential background playlist, pulling recording, and media lifecycle.
- [route-map.json](route-map.json): source GeoJSON for roads and stop names.
- [CONTRIBUTING.md](CONTRIBUTING.md): setup, checks, and contribution workflow.
- [style.css](style.css): HUD and screen layout.
- [tests](tests): physics and route verification tests.

## Commands

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Build production bundle: `npm run build`
- Run tests: `npm test`
- Format source/docs: `npm run format`
- Run all automated checks: `npm run check`

## Working conventions

- Prefer small, focused edits in the existing module boundaries.
- Keep gameplay units consistent: meters, kilograms, and newtons.
- Preserve the phase split between Workshop and Procession.
- If changing physics tuning, update the relevant notes in [README.md](README.md) so future agents understand the tradeoff.
- Do not replace the project with a framework such as React or a heavyweight physics engine unless the task explicitly requires it.
- Keep camera, HUD, and input logic decoupled from the physics simulation.

## Physics and gameplay notes

- The project intentionally uses a gameplay-friendly fracture approximation rather than a real wood science model.
- Constraint stress detection is implemented by reading solved equation multipliers and removing overloaded joints.
- The route uses the supplied GeoJSON coordinates; road widths, terrain, and scenery remain gameplay approximations.
- Steering is intentionally assisted for playability while preserving momentum and tilt behavior.

## For agent behavior

When making changes:

1. Read the relevant module and [README.md](README.md) before editing.
2. Keep changes scoped to the current feature or bug.
3. Prefer adjusting tuning values and module interfaces over rewriting the whole simulation.
4. Verify with `npm test` for physics/route changes and `npm run build` for frontend regressions when relevant.
5. When adding new features, keep the same modular structure and document the design in the nearest existing file.

This project is intentionally compact and educational: the best contribution is one that stays readable, testable, and easy to extend.
