# Webcam gaze experiment

Skim's webcam experiment runs in the hosted reading lab, or the local lab opened with `npm start`. The Chrome extension continues to use pointer and keyboard input. The camera is off until someone opens camera setup and selects **Start camera setup**.

## What changed in 0.2.2

Calibration now counts accepted face samples rather than every click. The pinned WebGazer API can silently reject a click when eye features are unavailable, so Skim checks the active ridge model before and after recording. A rejected click keeps the current target and asks the user to adjust face position or lighting. If stored samples cannot be inspected, setup stops the camera and offers retry guidance. All 45 accepted samples are still required before the separate held-out check; no accuracy threshold was relaxed.

## What changed in 0.2.1

The earlier adapter downloaded an unversioned WebGazer script from Brown University. WebGazer 3.5.3 uses `./mediapipe/face_mesh` as its default model path. That path resolves against the page containing it, and the earlier Skim deployment did not contain that directory. A successful script download therefore did not establish a working face detector.

The lab now serves a fixed copy of `webgazer@3.5.3` and its matching MediaPipe assets from `dist/vendor/webgazer-3.5.3/`. Before startup, the adapter sets an absolute same-origin `faceMeshSolutionPath` based on the adapter script's URL. This works with both `/lab` and `/lab.html`, and with the local server. The runtime script also has a SHA-384 integrity attribute. A failed or timed-out script load is removed and can be retried.

After a person selects **Start camera setup**, the adapter first probes WebGL2, then WebGL. It releases that temporary graphics context and removes the probe canvas. If usable WebGL is unavailable, Skim shows a clear pointer fallback before downloading the tracker or requesting the camera. This avoids the pinned MediaPipe runtime's native alert in browsers where WebGL cannot initialize.

This fixes a dependency and asset-path defect. It does not establish human tracking accuracy.

## Exact dependency provenance

| Item | Pinned value |
| --- | --- |
| npm package | `webgazer@3.5.3` |
| Upstream commit | `b12701dd7b6d7b00d4b8dbebf87fdec840c24999` |
| Published package | `https://registry.npmjs.org/webgazer/-/webgazer-3.5.3.tgz` |
| Package SHA-256 | `ddb577d3b971ce62018cce17e197546fcdc3db9eb51b57cf995b7ca777ca2443` |
| MediaPipe Face Mesh | `0.4.1633559619`, as shipped in WebGazer's package |
| Face landmarks wrapper | `@tensorflow-models/face-landmarks-detection@1.0.6` |
| TensorFlow.js components | `4.22.0`, recorded in the upstream lockfile |
| Runtime footprint | 18,862,912 bytes before HTTP compression |
| Vendor footprint | 22,835,870 bytes, excluding the manifest itself |

The [vendor manifest](../dist/vendor/webgazer-3.5.3/manifest.json) lists every shipped file's path, role, byte count, and SHA-256. The original npm SHA-512 integrity value is recorded there too. No upstream dependency script runs during restoration.

Verify the checked-in files without network access:

```sh
python3 scripts/vendor-gaze.py --verify
```

Reconstruct the selected files from pinned, checksum-verified upstream downloads:

```sh
python3 scripts/vendor-gaze.py --fetch
```

This command downloads packages to verify their published integrity, then reads only explicitly named regular archive members. It does not install npm dependencies, execute upstream code, or fetch whatever the latest version happens to be. Optional `--cache-dir /path/to/cache` reuses already downloaded archives after checking them again.

WebGazer's project says that updates are no longer guaranteed as of February 24, 2026, with community support continuing. Pinning makes a release inspectable; it does not make the dependency actively maintained. See the [upstream project](https://github.com/brownhci/WebGazer) and [project website](https://webgazer.cs.brown.edu/).

## Source and notices

The vendor directory retains WebGazer's original readable modules, npm package file, exact package lock, and webpack configuration. The complete upstream source map, with 1,229 embedded source entries, is included at `source/webgazer.js.map.gz`. Its uncompressed hash and length are in the manifest. The map is compressed for smaller source downloads and is not needed to run the tracker.

For debugging, decompress it and copy it beside `webgazer.js`:

```sh
gzip -dk dist/vendor/webgazer-3.5.3/source/webgazer.js.map.gz
cp dist/vendor/webgazer-3.5.3/source/webgazer.js.map dist/vendor/webgazer-3.5.3/webgazer.js.map
```

These two generated files are for a local debugging copy. The release checker rejects files outside the recorded vendor inventory, so remove those generated copies before packaging an unchanged release.

The vendor README documents an isolated upstream rebuild using the included original build inputs. Release restoration uses the verified published package; it does not claim that builds on different machines will produce identical minified bytes. The project and vendor source downloads keep these materials together.

WebGazer's original GPL notice, the full GPL version 3 text, Apache 2.0 text, MIT notices, dependency versions, and source copyright headers are retained. See [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md). The project does not rely on WebGazer's conditional LGPL licensing option.

## Camera and data lifecycle

Before consent, the lab loads no tracker or face-model assets and requests no camera permission. After consent and a successful graphics probe, it fetches the pinned assets from the same host serving the lab. The separate compatibility page also loads these assets after a deliberate **Check compatibility** click, without opening a camera. That host receives ordinary asset requests. Skim adds no frame, gaze-coordinate, or calibration upload endpoint.

Camera frames, calibration, and estimates stay in the current browser context. `saveDataAcrossSessions(false)` prevents WebGazer's calibration persistence, and the adapter resets its regression models in memory. Skim does not record video. Browser asset caching and normal hosting access metadata are separate from camera data.

Stop, Escape during setup, a hidden tab, page exit, and a calibration-invalidating resize release captured camera tracks. An initialization guard also releases a camera stream if permission arrives after cancellation. Initialization has a 45-second deadline, and the library download has a 30-second deadline. During tracking, five seconds without valid predictions stops the camera.

The wrapper stops tracks itself because this pinned WebGazer version's `end()` does not reliably stop its media stream. Removing the tracker UI alone is insufficient. These paths have automated lifecycle tests, but the actual camera light and browser permission behavior still need a human device check.

## Accuracy gates

Calibration uses nine screen targets, with five accepted samples from deliberate pointer clicks while looking at each target. Mouse movement is not emitted as gaze. Automatic pointer training is disabled before the heldout check.

Validation uses five different target positions, with 850 ms to settle and 1,800 ms to collect estimates at each target. The target positions do not train the regression. Each target needs at least eight usable predictions and 70% valid coverage of the callbacks received during its measurement period.

The median-error limit is the smaller of 100 CSS pixels and half the median visible paragraph height. The 90th-percentile limit is the smaller of 180 pixels and 1.8 times that median limit. Every target's own median must also meet the 90th-percentile limit. These are product gates for a cautious experiment, not published accuracy guarantees.

A passing check still requires a deliberate **Try gaze mode** click. A failed check leaves pointer mode available. Head movement, lighting changes, glasses, window movement between screens, and tracker drift can degrade a calibration. There is no validated continuous drift detector. The current interface selects broad paragraph regions and then exact source sentences; it does not establish word-level fixation or comprehension.

## Verification before calling gaze reliable

The automated tests cover consent boundaries, local asset paths and script integrity, failed downloads and retry, cancellation races, hidden-tab shutdown, viewport changes, unavailable graphics, model cleanup, and concurrent compatibility checks. These are mocked lifecycle tests, not measured camera accuracy.

Open the public [compatibility page](../dist/compatibility.html) and select **Check compatibility** to test a real browser without granting camera access. It checks HTTPS or localhost, usable WebGL, and WebAssembly. On supported browsers it then loads the same pinned runtime and model assets and initializes the detector. A successful check means that those components initialized in that browser; it does not measure gaze accuracy.

The page calls this adapter API only after the button is selected:

```js
const result = await SkimGaze.checkCompatibility({
  onProgress({ stage, message }) {
    // Render message as text. No frames, gaze data, or user text are involved.
  }
});
// result: { ok, code, message }
```

The check never calls `webgazer.begin()` or `getUserMedia()`. It disposes every detector made available to it and clears the cached reference so a later camera session cannot reuse a closed model. It has a 45-second overall deadline and permits one in-flight initialization. If native initialization is still unresolved after timeout, another attempt returns `busy` until that operation settles or the page reloads. A detector that arrives late is disposed. No result is saved or uploaded.

Progress stages are `checking`, `loading`, and `model`. Result codes are `ready`, `insecure_context`, `unsupported_graphics`, `unsupported_wasm`, `model_failed`, `timeout`, and `busy`.

### Observed browser results

During the November 7, 2026 managed Chrome check, direct initialization of the packaged detector failed because that browser could not create a WebGL canvas context. The upstream runtime displayed an alert and then failed while loading its graph. Both packaged WASM files were separately fetched with the correct MIME type and successfully compiled in that browser. WASM compilation is not a successful detector-initialization result. The compatibility UI on the HTTP preview correctly stopped at its insecure-context guard. After publication, the HTTPS compatibility page in the managed browser correctly showed the unsupported-graphics fallback without loading the tracker.

The published HTTPS compatibility check then passed in Anthony's connected Chrome browser: the actual tracking model initialized, the success result appeared, and no camera permission was requested. See the [validation record](VALIDATION.md) and its screenshot. This establishes model startup on one browser. Camera access, calibration, sustained gaze accuracy, and physical camera shutdown still need a person at a webcam.

The remaining device check is concrete:

1. Open the local lab at `http://localhost:4173/lab.html`, or the public HTTPS lab. Confirm pointer mode works with the camera off.
2. Open camera setup, read the disclosure, and allow camera access. Complete calibration and the heldout check honestly. Record the displayed error and whether it passed, including failures.
3. If the check passes, try several paragraph changes without moving your head. Confirm that broad focus follows gaze often enough to be useful. Compare it with pointer mode on the same passage.
4. Stop, switch tabs, resize, and close the tab in separate runs. Confirm the physical camera indicator turns off. Deny permission in another run and confirm pointer mode still works.
5. Repeat across people, lighting conditions, glasses, and at least two camera/device types before promoting gaze as a dependable everyday feature. Report the number of failed calibrations as well as successful examples.

## Why gaze is still separate from the extension

Chrome Manifest V3 requires executable code, including WASM, to be packaged with an extension. Bundling these files would address remote-code restrictions, but it is not sufficient here: the pinned MediaPipe JavaScript also uses `new Function`, which conflicts with the extension's current strict content security policy. Shipping a relaxed or untested runtime would not solve reliability.

Chrome's offscreen API supports `USER_MEDIA`, so a future implementation could keep an explicitly started camera pipeline alive while a content script draws the lens. That design still needs permission onboarding, a compatible runtime build, calibration-to-viewport mapping, correct behavior across window moves and screen scaling, a visible stop control, and measured accuracy. No across-tab or native macOS gaze service is shipped in this release.

Primary platform references: [remote hosted code policy](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code), [extension CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy), and [offscreen documents](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
