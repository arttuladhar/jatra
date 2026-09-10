# Jatra

A playable foundation for the chariot game in `PROMPT.md`: a Three.js workshop and a Cannon-es rope-pulling procession, using vanilla ES modules.

## Run

Requires **Node.js 22.12+** (the Node 22 series is selected by `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Use `npm test` for physics, route, input, team-animation, and audio checks; `npm run build` writes a deployable site to `dist/`. A WebGL-capable desktop browser and keyboard are recommended.

## Controls

- Workshop: Up/Down selects actual 3D parts; Left/Right changes Traditional, Reinforced, or Slender construction. The camera pans to the selection. Drag to orbit; scroll to zoom. Enter or the button starts.
- Procession: hold W to ramp up team effort. Left/Right arrows turn left/right with a bounded steering assist, including from rest. If both are held, the most recently pressed direction wins; releasing it restores the other held direction. Space gradually applies brakes. Release to coast; P pauses; R rebuilds.
- Keep the whole chariot on the road. Leaving the rendered street footprint progressively weakens joints; farther/faster excursions do more damage. Returning stops additional wear but does not repair it. The HUD shows damage and an off-road warning.
- Pass through the gold rings in order. A broken joint or a chassis tilt beyond the allowed angle ends the attempt. Simulation continues after failure to show falling pieces. Reach Basantapur intact to win.

## Modules

- `main.js`: rendering, camera, 3D component placard, team visuals, HUD, phase transitions.
- `builder.js`: reference-inspired procedural meshes and configurable wood/construction properties.
- `physics.js`: world, independently simulated pieces, hinges, lock constraints, reaction-force fracture, rope forces and brake drag.
- `teams.js`: articulated pullers, speed-driven strides, effort-driven heaves, and ropes following their hands. Animation uses simulation time so pause/help freezes it.
- `sound.js`: streamed procession playlist and pulling audio, using native media elements.
- `controls.js`: held-key state and discrete workshop actions.
- `route.js`: a GeoJSON-derived loop with twelve ordered stops, street meshes, collidable buildings, and bumps.
- `style.css` / `index.html`: responsive overlay and accessible controls.

## Physics and reference notes

Distances use meters, mass uses kilograms, and forces use newtons. The timbers keep their specified roles; construction variants change mass, joint strength, compliance, wheel diameter/tower height, and brake friction. Values are gameplay tuning, **not measured wood properties or a validated chariot engineering model**. Flexibility adjusts constraint stiffness rather than bending individual beams.

Cannon-es has no automatic breakable-joint switch. After every 1/120-second physics step, `inspectJoints` reads each equation’s solved `multiplier` and removes an overloaded constraint from the world. Solver force caps are deliberately above breaking limits so stress is not clipped before detection. Rotational reactions use a nominal 1 m lever arm when compared with linear-force thresholds. This is a tunable fracture approximation, not a material failure model. Detached parts remain dynamic collision bodies. A tower tier is the smallest detachable tower unit; add separate bodies and joints for individual timbers if finer destruction is needed.

The reference images were studied for solid disc wheels, timber proportions, crossed tower framing, repeated rope bands, foliage and red/gold ornament. They are not used as textures. Comments in `builder.js` identify extension points for carved faces and finer geometry. Tower foliage and decorative elements move with their tier. Rope lines and devotees visualize the two force application points; they are not independently simulated rope segments or pedestrians.

The route uses 8 m streets and follows the LineString in `route-map.json`. Checkpoints require passing within 4 m; the HUD previews the next turn and turns red within 25 m if speed exceeds 1 m/s. Longitude/latitude are projected into local metres (east +X, north −Z), with Basantapur at the origin. The supplied geometry measures approximately 1.703 km; it is not rescaled to the previous 1.8 km. Point features sorted by `stop` supply the twelve stop names, including the separate Basantapur start and finish. The file must contain exactly one closed LineString, distinct adjacent finite coordinate pairs, and named Point features numbered consecutively from 1. Point coordinates must match the ordered LineString vertices; invalid data reports a descriptive error. Roads connect the supplied vertices directly, without inferring additional streets. The flat base with small raised road bumps approximates uneven terrain. The file is the route source of truth; it does not provide surveyed road widths, elevations or building footprints. Deformable timber and a full rope simulation are outside this foundation.

Implementation references: [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html), [Cannon-es constraint/equation API](https://github.com/pmndrs/cannon-es/blob/master/dist/cannon-es.d.ts).

Steering uses an intentional gameplay assist: Left/Right arrows smoothly yaw the intact assembly together (about 20 degrees/second), preserving its existing momentum and tilt. This overcomes the fixed wheel axles’ resistance to rope-only turning. Normal collision and joint stress calculations still run each step; steering assistance stops after a joint breaks. Road checks use the same extended rectangles as the rendered streets, including overlaps at corners, and sample the chassis/outer-wheel footprint.

The procession camera supports drag-to-orbit and scroll-to-zoom while following the chariot. Your chosen angle and distance are preserved as it moves, and camera controls also work while paused. Use Overhead view to see over buildings or Reset view to restore the elevated default. The Steering readout shows the received direction, or explains when steering is paused/disabled. Keys also work in browsers that omit KeyboardEvent.code.

Game keys are handled during event capture so page-level shortcut handlers cannot swallow steering events. Hold the on-screen Left/Right buttons with a mouse or touch as an alternative; focused buttons also support holding Space/Enter.

Road bumps have yellow/charcoal stripes only, with no signs or approach markings. Release W and hold Space before crossing. Bump dimensions and physics are unchanged; placements follow the current road segments. Houses use stylized Newari-inspired brick courses, dark timber bands, projecting lattice window frames, stone plinths, and pitched terracotta roofs. Each street side has its own deterministic sequence of narrow/wide frontages, one-to-five-storey heights, setbacks, and empty lots, breaking up the repeated rows. Occasional two- or three-tier neighborhood temples replace houses, with stepped stone bases, timber struts, and brass finials. Building bodies match the varied footprints, and scenery placement checks all streets to keep the route clear. Shared procedural textures keep details lightweight.

Scenery references: [Asan’s streets, temples and courtyards](https://en.wikipedia.org/wiki/Asan,_Kathmandu) and [Maru’s temple-square layout](https://en.wikipedia.org/wiki/Maru,_Kathmandu). Google Maps could not be accessed during this update. These references inform the scenery; the road layout comes from `route-map.json`, and temples are illustrative rather than replicas or geographically exact placements.

The procession starts at Basantapur facing Pyaphal. All chariot bodies rotate together at assembly time so the first heave follows the first road segment without straining joints. The mini-map preserves the projected route proportions and displays its computed length. Finish detection requires visiting every preceding stop before returning to Basantapur; occupying the shared start/finish location at spawn does not complete the route.

## Procession audio

Starting the procession unlocks browser audio at 45% volume. `audio/jatra1.mp3` plays first, followed by `audio/jatra2.mp3`, then the pair repeats. Holding W, either steering arrow, or an on-screen steering button loops `audio/jatra_pull.mp3` over the music. Releasing all pulling controls stops and rewinds the pull clip. Background music is slightly quieter during pulling so the call remains audible. The synthesized soundscape has been removed.

Header controls mute both recordings or adjust their volume, including before starting. Pause, the controls dialog, and hidden tabs pause playback without losing the music position. Returning to the workshop resets to the first track; success and failure stop both recordings. If autoplay blocks playback, use Enable sound. The two native audio elements are authorized together by the start gesture so the pull clip can play later without another click. Recordings stream directly, and Vite includes all three MP3s in the production build. Physics and steering are unchanged.

## Development and verification

Run `npm run format` to format source and documentation, and `npm run check` for formatting, tests, and a production build. `npm run preview` serves the built site locally. GitHub Actions runs these checks and a dependency audit on every push and pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, deployment paths, browser checks, and contribution conventions; [docs/ASSETS.md](docs/ASSETS.md) records the local assets, and [docs/REVIEW.md](docs/REVIEW.md) records the initial quality review.

This is a gameplay prototype. The physics are an approximation, audio tests use a fake media element, and automated checks do not certify visual fidelity or performance on all devices. Vite reports a large JavaScript chunk because Three.js and Cannon-es ship together; this is tracked as a performance limitation rather than hidden by changing the warning threshold. Current open work is listed in [TODO.md](TODO.md).
