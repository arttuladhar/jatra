# Contributing

Use Node.js 22.12 or newer; `.nvmrc` selects the Node 22 series used by CI. Run `nvm use` if you use nvm, then `npm ci` to install the locked dependencies. No credentials or environment variables are needed.

## Local workflow

1. Read `AGENTS.md` and the relevant module before editing.
2. Run `npm run dev` and use the local URL printed by Vite.
3. Keep changes inside the existing module boundaries. Document physics tuning and route/audio behavior in `README.md`.
4. Add regression tests for behavior changes using the built-in `node:test` runner. Do not add a testing framework for simple assertions.
5. Run `npm run format`, then `npm run check` (format check, all tests, production build).
6. Run `npm audit` when dependencies change. Commit `package-lock.json` together with `package.json`.

`npm run preview` serves the last production build locally. `vite.config.js` uses relative asset URLs for static hosting. For an explicit deployment path, use `npm run build -- --base=/jatra/` and deploy the entire generated `dist/` directory, including its MP3 assets. Do not commit `dist/` or `node_modules/`. Preview and dev servers are local development tools, not production servers.

## Browser smoke check

Use a desktop browser with WebGL and audio enabled:

- Workshop: select and customize each part; orbit, zoom, and start using the keyboard and the button.
- Procession: hold W, steer in both directions, brake with Space, and check the camera/HUD. Off-road travel should increase damage; the gold checkpoints must advance in order.
- Keyboard: Tab to buttons and activate them with Enter/Space. The volume slider's arrow keys must adjust volume without steering.
- Audio: confirm `jatra1` plays first, `jatra2` starts after it ends, and the playlist repeats. Only the pull clip overlays the current music track while pulling. In browser developer tools, seeking near the end of the active media element can shorten this check; MP3 duration estimates may change while loading.
- Lifecycle: pause/resume, open/close help, hide/return to the tab, mute/unmute, and rebuild. Audio must stay silent while paused or in the workshop. Restarting must begin at the first track.
- Repeat a few rebuilds, check for browser exceptions, and inspect the generated production build.

Automated tests exercise simulation and media scheduling with a fake media element. They do not replace real browser audio decoding, autoplay, accessibility, or visual checks. The CI workflow runs formatting, tests, build, and a dependency audit on pushes and pull requests.

## Scope and assets

Preserve vanilla ES modules, Three.js, Cannon-es, and the Workshop → Procession loop. `PROMPT.md` is the original design brief; current behavior and the supplied `route-map.json` take precedence over its older route description. `TODO.md` distinguishes completed work from remaining prototype limitations. See `docs/ASSETS.md` for the checked-in media inventory.

The supplied `.github/workflows/deploy-pages.yml` runs checks and publishes `dist/` on pushes to `main` or manual dispatch. It requires GitHub Pages to be configured to use GitHub Actions in the repository settings. Its build and deployment actions are pinned to commit revisions.
