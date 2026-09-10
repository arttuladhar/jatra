# Initial code quality review

Reviewed for the first repository commit on 2026-09-09. Scope: source modules, UI, GeoJSON input, audio lifecycle, automated tests, dependencies, asset packaging, and development documentation.

## Findings addressed

| Finding                                                                                                            | Change                                                                                                                                            | Verification                                                           |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Global key capture prevented native Enter/Space button activation and did not recognize code-less Space as braking | Preserve keyboard actions for native controls and normalize Space in `controls.js`                                                                | Input regression tests; browser keyboard smoke check                   |
| Invalid GeoJSON could produce undefined/NaN geometry or zero-length segments                                       | Validate the closed LineString, finite coordinates, consecutive stop numbering, names, and matching stop positions before projection              | Malformed-route tests, existing route geometry and collision tests     |
| Route labels were interpolated into SVG HTML                                                                       | Build SVG nodes and assign label `textContent`                                                                                                    | Browser literal-label check                                            |
| A pending audio unlock could restore an old playback position after a restart                                      | Track reset revisions and ignore stale playback failures/positions                                                                                | Asynchronous audio restart regression test                             |
| Hidden-tab physics depended solely on browser frame throttling                                                     | Explicitly skip simulation steps while the document is hidden                                                                                     | Browser lifecycle smoke check; existing pause/physics tests            |
| Dense formatting and missing contributor instructions made review and reproduction harder                          | Consistent formatting, pinned formatter, Node version declaration, `npm run check`, and CI with read-only permissions and pinned action revisions | Clean install, format check, tests, production build, dependency audit |

The existing background audio already uses a single music element: `jatra1` finishes, `jatra2` finishes, then the sequence repeats. The separate pull recording is intentionally layered only while pulling; no second background music player was introduced.

## Verification

- Automated suite covers construction presets, steering, brakes, joint fracture, road departure, ordered loop checkpoints, scenery clearance, malformed route data, team animation, native keyboard handling, sequential audio, autoplay failure, and reset/pause/mute behavior.
- `npm run check` runs formatting checks, the full automated suite, and the production build.
- `npm audit` checks the installed dependency tree for known advisories.
- Browser checks cover application startup, native control activation, literal route labels, audio playlist transitions, pulling, mute, pause/help, and rebuild.

Executed results: `npm ci` and `npm run check` passed; all 26 tests also passed under Node 22.23.2 (the suite was additionally run under Node 26.5.1). `npm audit` reported zero known vulnerabilities. Chrome with software WebGL passed production startup, native help-button activation, both playlist transitions, pull press/release, mute/resume/help/reset, and runtime-error checks. Focused browser checks confirmed literal route labels and a frozen simulation when the document is hidden. No full-route manual completion, cross-browser matrix, or GPU performance benchmark was performed.

The remote repository did not have GitHub Pages enabled at review time; the supplied deployment workflow requires that repository setting. The code push and automated check workflow do not depend on Pages. CI provides repeatable automated checks for subsequent changes; browser steps are documented in `CONTRIBUTING.md`.

## Remaining limits

This review is not a certification that the prototype is defect-free or production-ready. Dense scenery and shadows still need profiling on lower-end hardware. The physics intentionally approximate fracture and steering, and automated tests do not prove full-route human playability or authenticity. Vite's large-JavaScript-chunk warning remains visible. The MP3 playlist adds approximately 23 MB of static assets, streamed rather than decoded into long-lived audio buffers. Media provenance and missing license metadata are recorded in `ASSETS.md`. The supplied GitHub Pages workflow builds and deploys static assets on pushes to `main`; it uses the same Node version and check command as CI. There is no server, authentication system, or account storage in this repository.
