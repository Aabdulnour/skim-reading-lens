# Skim Reading Lens for Chrome

Version **0.2.1**, consumer beta candidate. Chrome 120 or newer.

Skim is a local reading lens for long answers and articles. It follows your pointer, highlights an exact sentence, and keeps the surrounding text available. It does not verify claims or measure understanding. Sentence scoring currently uses English-language cues.

## Installation

The intended consumer distribution channel is the Chrome Web Store, which provides one-click installation and automatic updates. The store listing must be approved before that route is available. This source folder is also usable for local testing.

For an unpacked installation:

1. Download and unzip the extension bundle.
2. Open chrome://extensions.
3. Enable **Developer mode**, choose **Load unpacked**, and select the folder containing manifest.json.
4. The local welcome page opens. Choose **Start the practice lens**, then hover over a practice paragraph.
5. Use Chrome's puzzle-piece menu to pin **Skim Reading Lens**.

An unpacked installation does not receive Web Store updates. Replace the folder with a newer release, click Reload on the extension card, and reload open webpages.

## Everyday use

Click Skim on an ordinary webpage, then choose **Start here**. Pause your pointer over a paragraph for about a quarter second. The dock appears at the top of the page and shows the exact sentence it selected.

The dock offers four reading goals: **The answer**, **Next steps**, **The catch**, and **Key details**. Change goals without changing the source text. Minimize the dock when you want more room. Pause stops attention on the current page; the close button or Escape stops the lens until the next activation or page load. Escape is ignored in typing fields and dropdowns.

If the dock covers text near the top, minimize it or scroll slightly. The dock is part of the webpage viewport. It is not a macOS notch app and does not run over native applications.

### Make it return automatically

In the popup, select **Allow** beside **Remember on this site**, then approve Chrome's request. Skim requests only the current scheme and hostname, such as https://chatgpt.com/*. It does not request access to every site at once.

This permission covers the selected hostname on all its ports, as defined by Chrome's host-permission model. HTTP and HTTPS are separate, and subdomains are separate. Up to 100 sites can be remembered.

Chrome stores a persistent content-script registration for the approved sites. Skim restores registrations after browser startup and extension updates. Repeated automatic injection is idempotent and does not turn an already active lens off.

Declining the permission leaves **Start here** available. No permanent site access is needed for that one-off action.

### Stay in control

- **Pause lens everywhere** stops open lenses and automatic activation while keeping your remembered sites.
- **Resume** restores automatic activation on remembered websites.
- **Forget** removes the site from automatic activation and removes its explicit host grant.
- **Remove all site access** in Settings clears remembered sites and all optional host grants, including broader grants that may have been changed in Chrome itself.
- Removing a site's permission in Chrome also removes it from Skim's remembered list.

The lens suspends highlights while the tab is hidden or cached for Back/Forward navigation. On a cached return, it rechecks pause and remembered-site preferences before resuming.

### Quiet reader

**Open in a quiet reader** imports a bounded plain-text selection or the current page:

1. Selected text takes precedence.
2. Otherwise Skim tries the latest rendered ChatGPT assistant response.
3. Otherwise it tries an article or main reading area, then page paragraphs.

Inputs, editable areas, hidden elements, and scripts are excluded. The import is capped at 24,000 characters. If automatic extraction misses the right content, select the desired passage before opening Skim.

## Privacy and storage

The extension does not send network requests containing page content. It has no account, analytics, advertising, remote decision service, or camera integration.

It stores these values in chrome.storage.local:

| Key | Contents |
| --- | --- |
| skimPreferences | Reading goal, global pause state, and minimized-dock preference |
| skimSites | The exact scheme/hostname match patterns the user chose to remember |

These values do not include browsing history, page text, or gaze data.

Explicit reader imports use a random skim-import-* key in chrome.storage.session. The record contains bounded text, title, and the generic source label Current tab, with no source URL. The reader consumes and removes it. A later import clears abandoned records. Chrome clears session storage when the browser session ends. Settings can also clear waiting imports.

Text already loaded in a reader remains in that tab's memory until the tab is closed or reloaded. Removing the extension removes its extension storage.

The hosted webcam experiment is separate. **Explore experimental webcam gaze** opens /lab.html at the project website without transferring page text. The extension reader contains no remotely loaded gaze code.

Privacy details: https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/privacy.html

## Permissions and implementation

Required permissions:

| Permission | Purpose |
| --- | --- |
| activeTab | Temporary access after clicking Skim, for one-off highlighting and explicit text import |
| scripting | Inject the packaged lens/extractor and register the lens on remembered sites |
| storage | Save preferences and remembered sites; transfer explicit reader imports temporarily |

Optional host declarations are https://*/* and http://*/*. These declarations allow Chrome to request a specific site later. They are not a permanent grant at installation.

The popup calls chrome.permissions.request directly inside the user's **Allow** click, before asynchronous tab lookups or worker messages. The worker validates exact host patterns and confirms a grant exists before registering scripts. User mutations are serialized to avoid losing concurrent opt-ins. UI-only site-management messages are restricted to the extension's own pages.

The worker registers auto.js followed by overlay.js in the top frame at document_idle. It uses persistAcrossSessions: true and never registers every website by default. Automatic activation is idempotent.

The lens uses CSS Custom Highlights and DOM ranges. It does not wrap, replace, rewrite, or move source text. It observes only the currently active paragraph for streaming changes, with bounded text extraction. It clears attention on scroll, blur, and hidden tabs. The small shadow-root dock is the only page UI it adds.

## Supported boundaries

Ordinary HTML reading content is the target. Chrome's settings, Chrome Web Store, some PDFs, browser-internal pages, cross-origin frames, closed shadow roots, and canvas-rendered text may not be readable. Mobile Chrome extensions are not covered by this release.

The extension's pointer behavior is distinct from eye tracking. Real webcam gaze remains an experimental web-demo feature requiring consent, calibration, and device validation. No claim is made that the extension follows the user's eyes.

## Checks

From the project root:

    node extension/tests/check.cjs

The Node fixtures exercise extraction preservation, permission denial, exact-site grants, lifecycle recovery, revocation, pause/resume, concurrent changes, private-text cleanup, actual overlay selection logic, streaming updates, cached navigation, and invalidated-context cleanup.

These fixtures do not install an extension in Chrome, display Chrome's native permission prompt, verify every website, or replace Chrome Web Store review. See the repository's validation and release notes for browser evidence and remaining release steps.

## Source files

- popup.*: activation, opt-in, reader handoff, links.
- service-worker.js: settings mutations, permissions, registrations, first-install lifecycle.
- settings.js: bounded shared settings validation.
- auto.js: idempotent automatic-launch marker.
- overlay.js: pointer dock and exact-sentence highlight.
- extract.js: explicit bounded plain-text extraction.
- welcome.*: first-install practice using the real lens.
- options.*: preferences, remembered sites, revocation, waiting-import deletion.
- reader/: generated local reading room.
- icons/: packaged Chrome icons.

GPL-3.0-only. See the repository license and third-party notices.
