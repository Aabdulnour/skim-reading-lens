# Changelog

## 0.2.2 - 2026-11-06

- Copy or download pinned original sentences with the source title and paragraph references from the web lab and packaged reader.
- Clear pin counts, an empty state, and a download fallback when clipboard access is unavailable.
- Updated privacy wording for deliberate local exports and restored keyboard focus after removing a pin.
- Calibration advances only on verified stored face samples. Rejected clicks keep the current target, and unreadable calibration data stops setup with retry guidance.
- Clear stale on-page highlights when the pointer leaves or the window loses focus; scrolling cannot revive them before the pointer returns.

## 0.2.1 - 2026-11-06

- Public GitHub home, contributor instructions for Claude Code and other agents, and a real support address.
- Fixed webcam model loading by serving pinned WebGazer and MediaPipe assets locally after consent.
- Dependency hashes, license notices, corresponding source, and local asset verification.
- A camera-free compatibility check and a clear pointer fallback when browser graphics are unavailable.
- Updated download packages, release instructions, and privacy disclosures.
- The extension remains pointer controlled; the separate webcam lab remains experimental and needs physical-camera validation.

## 0.2.0 - 2026-11-06

### Release preparation

- Separate product homepage, installation help, public privacy information, and experimental reading lab.
- Chrome Web Store upload ZIP with manifest.json at the archive root.
- Separate tester ZIP, complete GPL source archive, listing assets, and submission packet.
- Fixed ZIP timestamps, sorted entries, stable file permissions, SHA-256 digests, and package integrity checks.
- Source export excludes private hosting identity, Git internals, credentials, and nested release artifacts.
- Prepared publisher instructions, privacy-field explanations, support templates, contribution guidance, and security reporting guidance.

### Extension beta

- Compact reading dock with reading goals and controls.
- Optional per-site permission and remembered activation.
- Global pause and site removal controls.
- First-install practice page and local settings.
- Versioned icons and consumer-facing product name.

These entries describe the release candidate's intended shipped behavior. docs/VALIDATION.md records the actual verification evidence. This version is not a Chrome Web Store approval or a native macOS release.

## 0.1.0 - 2026-11-05

- Initial local reading lens with source-preserving sentences, goals, focus words, and pins.
- Explicit on-page pointer overlay and local reader import extension prototype.
- Separate consent-based webcam calibration and validation experiment.
- Optional server-side Jev choice adapter with bounded requests and local fallback.
- Initial unit tests, browser checks, research notes, and source downloads.
