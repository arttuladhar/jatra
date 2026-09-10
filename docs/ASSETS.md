# Asset inventory

| Location               | Purpose                                                       | Supplied source                 |
| ---------------------- | ------------------------------------------------------------- | ------------------------------- |
| `audio/jatra1.mp3`     | First background recording in the repeating playlist          | User-provided recording         |
| `audio/jatra2.mp3`     | Second background recording, after the first finishes         | User-provided recording         |
| `audio/jatra_pull.mp3` | Loop layered over the current background track during pulling | User-provided recording         |
| `images/*.png`         | Chariot modeling reference images, not loaded by the game     | User-provided visual references |
| `route-map.json`       | Geographic centerline and twelve ordered procession stops     | User-provided GeoJSON           |

The game streams MP3s through two native media elements: one playlist player and one pulling player. Vite emits the three recordings as separate production assets. The largest recording is approximately 20 MB; avoid decoding the full playlist into Web Audio buffers or embedding it in JavaScript.

Models and building textures are procedural. CSS requests DM Sans and Playfair Display from Google Fonts; local sans-serif and serif fallbacks remain available when offline. No map API or API key is used.

No source URLs, credits, or explicit media licenses were supplied with the local MP3s and PNGs. This inventory records their provenance without assigning a license to them. Retain any original credits and permissions when replacing or documenting these assets.
