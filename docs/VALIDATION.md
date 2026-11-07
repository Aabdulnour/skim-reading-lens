# Validation and release status

Updated: November 6, 2026 (America/Toronto). Candidate: Skim Reading Lens 0.2.2.

## Supported next step

The candidate is prepared for a bounded beta and Chrome Web Store submission preparation. It is not a store-approved release. The public GitHub repository and support address are configured. Publisher registration/contact verification, a real installed-extension smoke test, and Google's review remain separate gates. A successful package check must not be described as completion of those gates.

## Version 0.2.2 continuation evidence

The continuation started from public commit `c4a35aa05e9c48275798990e2f9aa12ebee491a4`. All 133 public tracked files matched the existing Site source. A fresh local release reproduced all four v0.2.1 archive SHA-256 digests. The GitHub Releases collection was empty, confirming that the earlier distribution step had not completed.

The reader now exposes Copy pins and Download .txt, with title and paragraph references. A managed-browser preview using the actual application files confirmed:

- Pinning a caveat preserved “However, it does not include offline access.” exactly.
- Pinning a detail preserved “The price is $15.50 per month.” exactly.
- A real downloaded plain-text file contained both exact sentences, the entered title, and paragraph numbers.
- Clipboard unavailability on the HTTP preview gave the intended download fallback instead of a success claim.
- Removing all pins restored the empty state and disabled both export actions. After the focus fix, removing the last pin returned keyboard focus to Pin this sentence.
- Switching source text cleared the previous pins as described in the UI.

The calibration flow now checks the active pinned ridge model before and after each deliberate training click. Only a new stored sample advances the target. New automated cases cover 52 attempted clicks producing 45 accepted samples, failed sample inspection stopping the camera, 40 held-out observations adding no training samples, explicit continuation after a pass, and rejection when each validation target has only seven observations. These are mocked workflow results, not physical-camera accuracy measurements.

The on-page lens also now invalidates pointer coordinates on document exit or window blur. Its fixture covers pending dwell/scroll cancellation, ordinary element transitions, pointer return, and listener cleanup. Real installed-Chrome behavior remains unverified.

The [preview screenshot](assets/pinned-notes-preview.jpg) shows synthetic test text and the new controls. These observations cover a web reader, not an installed Chrome extension.

The connected browser rejected navigation to the Chrome Web Store developer console with “Not allowed”. No publisher registration, payment, account declaration, store upload or submission was performed during this continuation.

## Automated evidence

`npm test` passes 42 Node tests plus 12 extension scenario groups. `npm run test:release` adds six packaging and source-boundary regressions. The server tests use a mocked TypeSafe provider; the camera tests use mocked browser and WebGazer objects.

| Area | Behavior covered |
| --- | --- |
| Local reading core | Exact source text and offsets, negation, decimals, goal and topic selection, markup as literal input, source order, input caps, overflow merging, non-Latin text preservation |
| Optional Jev adapter | Documented Choice payload, only supplied IDs accepted, no request without a key, origin/host checks, input validation, safe errors, cache, concurrent deduplication, 4-second timeout, cooldown, 60-attempt process limit |
| Camera lifecycle | Consent before access, pinned same-origin loading and integrity, failed-load retry, graphics fallback, canceled/late permission cleanup, captured track shutdown, reset training, calibration does not imply validation |
| Extraction and reader handoff | Whitespace around inline elements, excluded inputs/hidden content, selection precedence, assistant-response extraction, bounds, opaque URL keys, stale and failed-import cleanup |
| Per-site activation | User-gesture request for the current site, denial fallback, exact-site normalization, validated messages, concurrent opt-ins, persistent/idempotent registrations |
| Settings and permission changes | Global pause/resume, startup/update reconciliation, external revocation, forgetting a site, removal of broader Chrome grants |
| On-page lens | Exact text ranges without DOM wrapping, four goals, active-paragraph streaming updates, minimize/pause, duplicate prevention, typing-safe Escape, global shutdown, context invalidation cleanup |
| Browser history | Back/Forward cache suspension and restoration, rechecking changed preferences and remembered sites, ordinary page teardown |

An independent read-only review identified two real lifecycle defects: invalidated Chrome API cleanup could leave an inert dock, and Back/Forward cache restore could lose the lens. Both were fixed and the relevant fixture groups were independently rerun successfully.

## Version 0.2.1 dependency and compatibility evidence

- The earlier unversioned tracker expected face-model files that the site did not contain. The fixed build includes the complete pinned runtime and sets its model path explicitly.
- The vendor verifier and release checker verify all 49 listed files, their hashes, original source, licenses, and build inputs. There are 18,862,912 runtime bytes and 22,835,870 total vendor bytes, excluding the manifest.
- A temporary managed-browser page loaded the actual pinned script and attempted detector initialization without calling camera startup. That browser could not create the WebGL context and the upstream tracker raised an alert. This was a failed detector initialization, not a camera or accuracy test.
- A separate browser exercise fetched both actual WASM modules with `application/wasm` and successfully compiled each with `WebAssembly.compile`. This establishes valid, reachable browser binaries, not a usable GPU or face detector.
- The new compatibility page showed a clear fallback on the HTTP managed preview because that origin is not a secure context. Automated tests separately cover unavailable graphics before any tracker download or camera request.
- On the published HTTPS site, the managed Chrome browser showed the intended unsupported-graphics message before any tracker download.
- On the published HTTPS site in Anthony's connected Chrome browser, the actual compatibility check passed. The pinned model initialized successfully, its result appeared in the UI, and no camera permission was requested. This is model-startup evidence on one browser, not human gaze accuracy. The [actual screenshot](assets/compatibility-check.jpg) records that result.
- The camera-free compatibility API has a 45-second deadline, one in-flight initialization, active-camera protection, and late-result disposal. It never calls `begin()` or `getUserMedia()`. Its readiness result does not grant camera permission or measure accuracy.

## Direct browser observations

The managed Chrome browser preview was used for UI testing. These were actual application files running as webpages, not an installed extension profile.

- Product homepage rendered at desktop size and in a 390-pixel mobile frame, with readable controls and no observed horizontal overflow.
- The homepage's local preview changed its exact highlighted source sentence when a different paragraph was selected.
- The packaged welcome page loaded the real `overlay.js`. Choosing The catch and resting on the third practice paragraph highlighted the complete sentence beginning “However, a highlighted sentence can still be wrong”. The full original paragraph remained visible.
- The dock's minimize/expand and pause controls worked. Escape removed the dock and highlight.
- The popup was inspected in a 360 by 600 frame. Its initial layout was too tall; marketing headings and extra spacing were removed. The revised layout kept the primary controls and reader/camera links visible. A Chrome-API-unavailable error appears in this webpage fixture because it is not an installed extension; it is not an observed installation failure.
- The installation page links to the lab and correct release filenames. The help page's feedback button downloaded a local blank template and displayed “Nothing was sent”.
- Prior reading-room checks still cover pointer selection, goals, pinning, pause, keyboard navigation, literal pasted markup, the 20-second labeled scripted tour, and mobile layout. The updated reader additionally opens the separate webcam lab without transferring imported text.

`store-assets/README.md` records screenshot provenance. Screenshots show actual UI on synthetic practice text; they do not assert installed-extension or camera validation.

## Packaging evidence

`npm run release` runs the Node, extension, and Python checks, regenerates the downloads, and checks source/runtime parity, versions, manifest permissions, bundled dependencies, CSP, required icon/screenshot dimensions, ZIP member paths and metadata, source exclusions, and SHA-256 checksums.

The Chrome Web Store package contains `manifest.json` at its root. The developer download has a `skim-extension/` folder wrapper. Source export omits private hosting metadata, Git history, secrets-file patterns, temporary QA pages, and nested release archives.

Two consecutive preliminary builds produced identical hashes. Rebuild after any later edit; the parity checker detects stale archives. `npm run release:check -- --submission` requires the configured public support address. It does not verify that Google has confirmed the address or accepted the listing.

## Not established

- Installation and actual permission prompts in Anthony's or another person's Chrome profile.
- Store account registration, policy certification, submission, approval, or store-managed updates in the wild.
- Every ChatGPT layout, custom website, PDF, embedded frame, or shadow DOM.
- A complete webcam session, calibration quality, drift, or sustained real-human gaze accuracy on a Mac. Model-only startup has passed on one connected Chrome browser.
- A live paid Jev call or the quality of its sentence choices. No provider key was supplied during this work.
- Faster reading, better comprehension, user retention, demand, or viral reach.
- A native macOS companion. The dock is inside a browser page.

Use the installed-extension checklist in `docs/RELEASE.md` before the first store submission, then invite a small beta cohort to test whether the interaction earns repeated use.
