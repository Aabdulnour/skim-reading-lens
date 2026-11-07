# Pinned webcam dependencies

WebGazer 3.5.3, upstream commit b12701dd7b6d7b00d4b8dbebf87fdec840c24999.

These are unmodified upstream runtime files. Skim serves them from its own origin after explicit camera-setup consent or a deliberate compatibility check. The compatibility check does not open a camera. They are not included in the Chrome extension. See /docs/GAZE.md in the source repository.

## Source and build inputs

source/src contains the original WebGazer modules. source/package.json, source/package-lock.json and source/webpack.config.js preserve the matching upstream build configuration. source/webgazer.js.map.gz is the complete upstream source map, with all 1,229 embedded source entries. It is compressed to keep source downloads smaller; decompress with gzip -dk source/webgazer.js.map.gz. The unmodified runtime's sourceMappingURL points to webgazer.js.map; copy the decompressed map to that filename beside webgazer.js for browser debugging. The map is not needed to run the tracker.

To rebuild upstream in an isolated temporary directory, copy source/package.json, source/package-lock.json, source/webpack.config.js and source/src there, copy mediapipe into src/mediapipe, then run npm ci and npm run build. The release restoration script uses the checksum-verified published package instead of claiming that another machine's rebuild is byte-identical. Upstream build dependencies are separate from Skim's zero-dependency runtime.

## Licenses

WebGazer: GPL-3.0-or-later, Copyright 2016-2026 Brown WebGazer Team. This project uses GPL version 3. The conditional LGPL option is not used. Original notice: source/LICENSE.md. Full GPL text: licenses/GPL-3.0.txt.

MediaPipe, TensorFlow.js, face-landmarks-detection, localforage and long use Apache-2.0. licenses/long.txt contains the full Apache 2.0 text. Original source copyright notices are retained. regression, seedrandom, lie and immediate use MIT notices preserved in licenses/ and source/seedrandom/. licenses/packages.json records the selected dependency versions. The source map retains upstream notices.

Restore exactly: python3 scripts/vendor-gaze.py --fetch. Verify without network: python3 scripts/vendor-gaze.py --verify. manifest.json records all shipped file sizes and SHA-256 digests.
