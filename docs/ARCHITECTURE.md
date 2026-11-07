# Architecture and boundaries

## Runtime layers

| Layer | Implementation | Responsibility |
| --- | --- | --- |
| Reading room | Buildless HTML, CSS, JavaScript | Stable text layout, goals, pins, original view, pointer/keyboard navigation, labeled simulation |
| Local selector | `dist/core.js` | Exact sentence boundaries and transparent English-language scoring cues |
| Webcam adapter | `dist/gaze.js` and pinned WebGazer 3.5.3 | Consent, camera startup, target calibration, heldout validation, estimates, shutdown |
| Camera dependencies | `dist/vendor/webgazer-3.5.3/` | Website-local runtime and face-model assets; excluded from the extension runtime |
| Optional semantic choice | `server.mjs` and TypeSafe Jev | Select a permitted sentence ID after explicit cloud opt-in |
| Browser companion | Manifest V3 extension | Deliberate page import and a local on-page pointer lens |

The attention loop is local. The application smooths webcam estimates, checks rendered paragraph geometry, and waits before switching regions. It does not send individual frames or gaze samples to a decision model. A new semantic choice is requested only when cloud mode is enabled and the focused paragraph, goal, or topic changes. The original sentence is displayed directly from the browser's source text.

## Default data behavior

Pasted text, selected sentences, pins, pointer events, and gaze predictions remain in the current browser context. The app adds no analytics, accounts, or persistent document database. Reloading clears custom text and pins. The reader can copy pinned sentences to the clipboard or download a plain-text file after a deliberate click. That local export includes the source title and paragraph numbers, preserves sentence wording, and makes no network request. Clipboard denial leaves a download option. The user controls any copied or downloaded file outside the tab. Browser and hosting infrastructure can still have normal access logs and asset caches.

Webcam mode loads the pinned WebGazer 3.5.3 runtime only after consent. The runtime and its required model files are bundled under `dist/vendor/webgazer-3.5.3/` and served by the same host as the lab. The adapter sets the model path explicitly before initialization. This fixes the earlier loader's dependence on model paths that were absent from the deployed site. See [GAZE.md](GAZE.md) for exact provenance, integrity checks, and maintenance instructions.

Runtime and model fetches are ordinary asset downloads, not a promise of zero network traffic. They do not require a new browser connection to Brown or a model CDN. Skim does not upload frames or gaze coordinates. `saveDataAcrossSessions(false)` disables persisted calibration. Regression models are reset in memory without touching unrelated browser storage.

The separate `compatibility.html` page calls `SkimGaze.checkCompatibility` only after a button click. It checks browser capabilities and initializes then disposes the same detector without calling `begin()` or requesting a camera stream. A bounded result reports setup support, not gaze accuracy. This gives users a troubleshooting step before the camera-consent flow. The page retains a pointer-mode link regardless of the outcome.

The camera stream is captured as soon as permission resolves. A generation guard stops a late stream if setup was canceled. Stop also stops every known track, because the current upstream `end()` is not sufficient on its own. A 45-second initialization deadline handles stalled model setup. Calibration does not unlock gaze mode: the heldout check must pass and the user must select Try gaze mode. The wrapper stops on a hidden tab, page exit, resize during tracking/calibration, or sustained absence of predictions. Moving one's head can still degrade accuracy without a reliable automatic drift detector.

## Calibration policy

There are nine targets with five accepted training samples each. A deliberate click counts only when the active pinned ridge model records an additional sample; rejected clicks keep the target in place with feedback. If sample inspection fails, camera setup stops with retry guidance. The five validation targets are different positions and do not train the regression. Each gets 850 ms to settle and 1,800 ms of measurement. At least eight valid samples and 70% valid coverage per target are required.

The error gates depend on the actual paragraph height: median error must be no more than `min(100 px, 0.5 * median visible paragraph height)`. The 90th percentile limit is `min(180 px, 1.8 * median limit)`, and every target's median must also be below that percentile limit. These are conservative prototype policies, not measured guarantees. They may reject many normal webcams. Dependency and lifecycle checks do not establish accuracy on a person's camera or device.

## Jev protocol

The server binds only to `127.0.0.1:4173`. `GET /api/status` reports whether a nonempty `TYPESAFE_API_KEY` is configured. It does not authenticate the key. The app exposes the cloud toggle only when that local endpoint reports configuration.

`POST /api/rank` accepts a paragraph ID, one of four reading goals, optional focus words, and a bounded list of sentence IDs and exact text. It calls `https://api.typesafe.ai/v1/systemone` with model `jev-1.14.0`. The request uses TypeSafe's Choice primitive: candidate sentences are descriptions in `criteria`, and the reading goal/topic are state. The response must contain `answers.selection.type === 'choice'` and a choice belonging to the submitted IDs. Only `{sentenceId, provider:'jev'}` is returned on success.

A missing key, invalid request, invalid provider result, or provider error returns a non-2xx status with a local-fallback indication. The browser keeps its local choice. A generation counter and AbortController prevent stale responses from overwriting a later reading selection. Canceling an in-flight browser request does not promise a refund of provider work that has already started.

Bounds: three seconds between new provider attempts, at most 60 attempts per server process lifetime, four-second provider deadline, no automatic retries, and in-memory successful-result caching with concurrent deduplication. Failed provider attempts count toward the cap. Cached results remain usable after the cap. The JSON body is limited to 24 KiB, with 2-32 candidates, at most 4,000 characters per candidate, 8,000 candidate characters total, and 180 topic characters. Oversized contexts fall back locally.

Exact-origin JSON POST and loopback Host checks prevent unrelated websites from casually spending the server key. Static files are constrained to `dist/`, including real-path checks. No key, provider body, paragraph, or internal stack is included in an API error. The cloud provider has its own processing policies once the user enables it.

Official protocol: https://docs.typesafe.ai/primitives/choice
Model reference: https://docs.typesafe.ai/models

## Extension boundaries

The extension has `activeTab`, `scripting`, and `storage`, with no required all-sites host grant. Version 0.2 declares optional HTTP and HTTPS host patterns and requests only the current scheme and hostname when a person chooses Remember on this site. It runs only packaged JavaScript. The content script uses CSS Highlight ranges, so it does not wrap or rewrite the host page's text. Its sentence scoring is a smaller local heuristic with four reading goals. It is explicitly labeled Pointer lens. A small top-of-page dock provides goal, pause, minimize, and close controls. The service worker serializes settings changes and reconciles persistent content-script registrations with saved preferences and actual optional permissions. Forgetting a site unregisters it and revokes its host access. Global pause unregisters automatic scripts; resuming restores approved sites. First installation opens a packaged practice page. Updates do not reopen onboarding.

Imports contain text, title, and a generic source label. A random key, not text, is passed in the extension reader URL. The reader consumes and deletes it from `chrome.storage.session`. The optional webcam link opens the demo without source text or source URL. This version does not implement gaze directly over arbitrary webpages or the whole operating-system screen.

## Beyond this version

The lab's dependency bundling removes one deployment failure. It does not turn the pointer extension into a gaze extension. A dedicated extension gaze flow would need an explicit camera surface, screen-to-viewport coordinate mapping, permission and tab lifecycle handling, validation across scrolling and dynamic ChatGPT responses, and measured drift. A systemwide Mac companion would add a separate native lifecycle and distribution path.

Measure installation friction, repeated use, and reading-task outcomes before increasing the setup burden. Compare a proposed camera flow against the existing pointer baseline. The optional Jev choice should improve an observed sentence-selection problem before becoming a required dependency.
