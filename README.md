# Skim Reading Lens

**You were going to skim it anyway.**

Skim brings a useful original sentence forward when your pointer rests on a paragraph. It is a small reading aid for long replies and articles, with a compact browser dock, a quieter reader, and optional activation on sites you choose.

**Version 0.2.1 is an open-source beta candidate.** The public repository is the development home, and the project site provides the demo and packaged downloads. Chrome Web Store submission and approval are separate steps; there is no published store listing yet.

- [Source and contributions](https://github.com/Aabdulnour/skim-reading-lens)
- [Project and downloads](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site)
- [Try the reading lab without installing](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/lab.html)
- [Installation guide](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/install.html)
- [Privacy](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/privacy.html)
- [Help](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/help.html)
- [Report a bug](https://github.com/Aabdulnour/skim-reading-lens/issues/new/choose)

Support: [justfornow609@gmail.com](mailto:justfornow609@gmail.com). Use synthetic examples in public issues. For a security-sensitive report, follow [SECURITY.md](SECURITY.md).

## What the extension does

1. Click Skim on a regular webpage and start the pointer lens.
2. Pause over a paragraph. Skim highlights one exact sentence without replacing or rewriting the page.
3. Choose the answer, an action, a caveat, or a concrete detail in the dock.
4. Enable the optional per-site setting if you want the dock to return on that site. Chrome asks for that site's permission once.
5. Pause everywhere or forget a site in Settings. Escape closes the lens in the current tab.

First installation opens a local practice page. The extension does not need an account, an API key, a server process, or a webcam. Its reading rules run locally. They are English-oriented and can choose an unhelpful sentence.

The **Open page in Skim** action opens a quieter local reader. An explicit text selection takes priority; otherwise Skim tries the latest rendered ChatGPT assistant response, then the page's article or main content. Text is limited to 24,000 characters and never uploaded by the extension.

## Install the beta

The Chrome Web Store will be the normal installation and automatic-update route after approval. Until then, the ZIP is a developer/tester build:

1. Download and unzip skim-extension.zip from the installation page.
2. Open chrome://extensions in desktop Chrome.
3. Turn on Developer mode.
4. Choose **Load unpacked**, then the skim-extension folder that directly contains manifest.json.
5. Follow the welcome page. Pin the extension from Chrome's extension menu if you want a visible button.

Do not drag the ZIP into Chrome, upload the source ZIP to the store, or select the folder above manifest.json.

An unpacked build does not get store updates. To update it, replace the files in the same folder and click Reload on the extension card. After a public store release, remove the unpacked copy and install from the verified store link. Preferences and permissions do not automatically migrate between different extension IDs.

Skim targets current desktop Chrome on macOS, Windows, and Linux. It is not a native Mac notch app. Chrome system pages, the Web Store itself, built-in PDF viewers, cross-origin frames, canvas content, and some custom page structures cannot be read by this version. Mobile Chrome and Safari are outside this release.

## A separate webcam experiment

The hosted [reading lab](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/lab.html) also offers experimental WebGazer estimates after consent, calibration, and a held-out accuracy check. This is separate from the installed extension. Opening the lab from the extension does not transfer page text.

The camera experiment estimates a screen region. It does not reliably identify individual words, measure comprehension, or verify claims. Human accuracy on your device is unvalidated. Failed checks return to pointer mode. The 20-second tour is scripted and visibly labeled as simulated attention.

Start with the [browser compatibility check](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/compatibility.html) if you want to test the tracking software before giving camera permission. It loads the tracking files only after you click, keeps the camera off, and reports whether the browser can start them. Passing this check is separate from passing gaze calibration.

The lab ships a pinned WebGazer runtime and its model assets with the website. Camera setup loads them from the same site only after the consent step. See [docs/GAZE.md](docs/GAZE.md) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for provenance, dependencies, and the device test that remains necessary. These lab assets are excluded from the extension runtime.

## Data and permissions

| Data or permission | What it is used for |
| --- | --- |
| activeTab | A one-off user action on the current page |
| scripting | The local lens and selected-page reader, plus scripts registered for sites you approve |
| storage | Reading preferences, the sites you explicitly remember, and temporary reader handoff |
| Optional HTTP/HTTPS site access | Only requested for the current scheme and hostname when you choose to remember that site |
| Page content and pointer movement | Processed locally for the visible reading feature |
| Imported text and title | Kept in extension session storage until consumed by the reader; stale imports are cleared on the next import |
| Remembered sites and preferences | Saved in chrome.storage.local, not browser sync |

Chrome site permissions cover all ports for an approved scheme and hostname. The extension keeps no browsing-history log, account identifiers, analytics, or saved conversation archive. It does not send text or pointer data to a developer service. The lab processes camera frames and gaze estimates in the browser. A normal website navigation and lab asset downloads still create ordinary requests to the project host. The optional local Jev mode described below has its own explicit text-sharing step.

The privacy policy describes local processing as data handling. “Local” does not mean that the extension never accesses page content.

## Run or develop locally

Requires Node.js 20 or newer. Python 3 is used for release packaging and artifact checks. The runtime dependencies are bundled; there are no npm packages to install for normal development.

Clone the public repository once and keep using that checkout:

```bash
git clone https://github.com/Aabdulnour/skim-reading-lens.git
cd skim-reading-lens
npm test
npm start
```

Open http://127.0.0.1:4173 for the product site or http://127.0.0.1:4173/lab.html for the reader. Stop the server with Ctrl+C. To develop the extension, run `npm run package`, then load the `extension/` folder through Chrome's **Load unpacked** control. After changing extension files, reload the extension card and refresh the test page.

`extension/reader/` is generated from the reading lab by the packaging script. Edit its source in `dist/` and run `npm run package` again. Do not maintain a second copy of the reader by hand.

    npm test
    npm run package
    npm run release:check

Or run the full local release command:

    npm run release

The packaging command creates:

| Artifact in dist/downloads | Purpose |
| --- | --- |
| skim-extension.zip | Unpacked tester install with a containing folder |
| skim-chrome-store-v0.2.1.zip | Store upload with manifest.json at the ZIP root |
| skim-source.zip | Complete publishable source, including tests and build scripts |
| skim-release-kit-v0.2.1.zip | Store upload, source, listing text, images, and publisher checklist |
| SHA256SUMS | Digests for the four ZIP files |

ZIP entries have fixed timestamps and permissions. Matching inputs on the same Python/zlib implementation produce matching artifacts. The source bundle excludes credentials, local hosting identity, Git metadata, build caches, and nested download archives.

For Claude Code or another coding agent, open this checkout and start with [AGENTS.md](AGENTS.md). [CLAUDE.md](CLAUDE.md) points to the same project guidance. A useful first request is: “Read AGENTS.md and docs/VALIDATION.md, run the existing checks, and complete the smallest unverified reading flow. Record the test evidence and any remaining limitation.” No GitHub Actions workflow or paid CI service is required to work on this project.

## Optional Jev decisions for local development

Jev is disabled by default and is not required by the extension. The optional local server reads TYPESAFE_API_KEY from its environment. Keep the key server-side.

In Bash, enter the key without saving it in command text:

    read -s -p 'TypeSafe API key: ' TYPESAFE_API_KEY
    export TYPESAFE_API_KEY
    printf '\n'
    npm start

In Zsh, start Bash first or use its equivalent hidden-input command. Visit the local reading lab and explicitly enable **Use Jev for this paragraph**. The server then sends the current paragraph's candidate sentences, reading goal, and focus words to TypeSafe. It does not send gaze coordinates or camera frames. Provider charges may apply.

The adapter bounds requests, validates the chosen sentence ID, caches repeated choices, and falls back locally on errors. See docs/ARCHITECTURE.md. Contract tests use a mock provider; no live paid Jev call was made during the initial build.

## Release status and contributing

See docs/RELEASE.md for submission steps and the manual installation checks that automated tests cannot replace. Passing a package check is evidence about the files, not Chrome Web Store approval or demonstrated user benefit.

Project code is licensed under GPL-3.0-only, with third-party dependencies covered by their included notices. See [LICENSE](LICENSE), [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md). Open focused issues and pull requests in [Aabdulnour/skim-reading-lens](https://github.com/Aabdulnour/skim-reading-lens). The downloadable source is also available from the project site.

The immediate priorities are a real installed-Chrome test, a small independent installation pilot, and a measured webcam trial. The release guide includes the acceptance checks. Gaze on arbitrary websites and a systemwide Mac dock remain separate future work.

The working name is descriptive and has not been cleared as a trademark. This project is distinct from other software called Skim, including the macOS PDF reader.

## Project map

| Path | Role |
| --- | --- |
| dist/index.html | Product homepage |
| dist/lab.html, styles.css, app.js | Interactive reading lab |
| dist/core.js | Local source-preserving sentence ranking |
| dist/gaze.js | Optional hosted camera consent, calibration, validation, and shutdown |
| dist/vendor/ | Pinned runtime and model assets for the separate webcam lab |
| extension/ | Browser dock, popup, remembered sites, settings, and onboarding |
| server.mjs | Local static server and optional bounded Jev adapter |
| scripts/package.py | Reproducible store, tester, source, and release-kit archives |
| scripts/release_check.py | Artifact, permissions, assets, and source-parity checks |
| docs/VALIDATION.md | Evidence and verification limits |
| docs/GAZE.md | Webcam dependency provenance, operation, and remaining validation |
| docs/STORE-LISTING.md | Prepared store listing and reviewer instructions |
| docs/RELEASE.md | Remaining publisher steps and update procedure |
| AGENTS.md, CLAUDE.md | Shared guidance for development with coding agents |
