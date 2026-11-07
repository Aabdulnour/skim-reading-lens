# Third-party notices

Skim's original code is released under GPL-3.0-only. See `LICENSE`.

## WebGazer

The optional website webcam experiment includes WebGazer 3.5.3. Copyright (C) 2016-2026 Brown WebGazer Team. Its npm package is licensed under GPL-3.0-or-later. This distribution uses GPL version 3 and does not rely on the project's conditional LGPL option.

- Project: https://github.com/brownhci/WebGazer
- Project and camera API documentation: https://webgazer.cs.brown.edu/
- Pinned upstream source: https://github.com/brownhci/WebGazer/tree/b12701dd7b6d7b00d4b8dbebf87fdec840c24999
- Original license notice: `dist/vendor/webgazer-3.5.3/source/LICENSE.md`
- Full GPL version 3 text: `LICENSE` and `dist/vendor/webgazer-3.5.3/licenses/GPL-3.0.txt`
- File inventory and integrity: `dist/vendor/webgazer-3.5.3/manifest.json`

The source distribution retains the original WebGazer modules, package file, matching lockfile, webpack build configuration, and the complete upstream source map with embedded sources. The source map is stored as deterministic gzip to reduce download size. See the vendor README and `docs/GAZE.md` for decompression, rebuild, and restoration instructions.

### Bundled dependencies

WebGazer's browser runtime and model assets include the following upstream components. Their original source headers and notices remain intact; the vendor manifest inventories the license materials alongside the executable files.

| Component | Version | Upstream license |
| --- | --- | --- |
| MediaPipe Face Mesh | 0.4.1633559619 | Apache-2.0 |
| TensorFlow face-landmarks-detection | 1.0.6 | Apache-2.0 |
| TensorFlow.js core, CPU/WebGL backends, converter, data and layers | 4.22.0 | Apache-2.0 |
| localforage | 1.7.3 | Apache-2.0 |
| long | 4.0.0 | Apache-2.0 |
| regression | 2.0.1 | MIT |
| seedrandom | 3.0.5 | MIT |
| lie | 3.1.1 | MIT |
| immediate | 3.0.6 | MIT |

The full Apache 2.0 text is retained in `licenses/long.txt` inside the vendor directory. Original localforage, regression, long, lie, and immediate license files are under `licenses/`. The original seedrandom source files, including their algorithm-specific license and copyright notices, are under `source/seedrandom/`. `licenses/packages.json` records the upstream package versions and license identifiers. These dependencies are distinct from Skim's own GPL license.

Camera use is optional and starts only after explicit consent. The website serves the pinned library and model assets from its own origin. The Chrome extension ships a separate pointer-only adapter; it does not bundle or execute these camera dependencies. A copy of this notice in the extension describes the whole source project, not an additional extension runtime dependency.

## Research acknowledgment

This project is an independent portfolio experiment. It is not affiliated with Brown University, TypeSafe, OpenAI, Microsoft, or the authors of prior reading-interface research. The working name Skim is not a claim of affiliation with the earlier Scim research project. See `docs/RESEARCH.md` for sources and the distinction between prior results and unvalidated claims about this prototype.
