# Chrome Web Store submission copy

**Prepared for:** Skim Reading Lens 0.2.2
**Status:** Submission draft. No public store ID or approval exists yet.  
**Product scope:** A local pointer-driven reading lens and quiet reader for desktop Chrome.

The uploaded manifest determines the title, version, and short description. Do not paste the source ZIP into the dashboard.

## Listing fields

| Field | Prepared value |
| --- | --- |
| Name | Skim Reading Lens |
| Version | 0.2.2 |
| Short description | Follow your pointer to a useful sentence in long replies and articles. Local by default, with optional per-site activation. |
| Language | English |
| Suggested category | Productivity, if that category is available in the current dashboard |
| Website | https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site |
| Support URL | https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/help.html |
| Privacy policy | https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/privacy.html |
| Cost | Free beta; no account or API key required for extension features |
| Distribution | Public beta after review, or Unlisted for an initial controlled pilot |
| Support email | justfornow609@gmail.com; verify through the publisher dashboard before submission |
| Source repository | https://github.com/Aabdulnour/skim-reading-lens |

## Detailed description

You were going to skim it anyway.

Skim Reading Lens helps you notice a useful sentence in long replies and articles. Start the lens, rest your pointer on a paragraph, and Skim emphasizes an exact sentence in place. Your page stays where it is, and the original words stay intact.

A small dock keeps the controls close:

- Choose the answer, a next step, a caveat, or a concrete detail.
- Pause or close the lens whenever you want.
- Remember a site if you want Skim to return there automatically.
- Forget individual sites or pause everywhere in Settings.

Prefer a quieter view? Open selected text or the current page in Skim's local reader. Read, change your goal, and pin original sentences without creating an account. Copy or download your pins with their title and paragraph numbers when you want to keep them.

First installation includes a short practice page. The core extension needs no API key, camera, subscription, or external server.

Your control comes first. One-off use starts only when you ask. Remembering a site asks Chrome for that site's optional permission. Page text and pointer input are processed locally. Skim stores preferences and the sites you approve; it does not send your page text to a developer service or include analytics.

This beta uses English-oriented local reading rules. A selected sentence is a suggestion, not a factual check or a guarantee of relevance. Keep the surrounding context.

The extension supports normal readable webpages. Browser system pages, built-in PDF viewers, cross-origin frames, and some custom page structures are unsupported. A separate website hosts an experimental webcam reading lab; eye tracking is not built into this extension.

The source is available under GPL-3.0-only at https://github.com/Aabdulnour/skim-reading-lens and from the project website. Third-party notices are included with the source.

## Single purpose

Help the user skim readable webpage text by emphasizing an original sentence in the paragraph they choose, or by bringing explicitly selected page text into a local reading view.

## Permission justifications

| Permission | Text for the dashboard |
| --- | --- |
| activeTab | Provides temporary access to the current webpage when the user clicks the extension to start the lens or open page text in the local reader. It avoids requesting permanent access to all sites at installation. |
| scripting | Injects the packaged local reading lens and selected-page extractor. It also registers packaged content scripts for the individual sites the user explicitly chooses to remember. |
| storage | Stores reading preferences and an explicit remembered-site list locally. Session storage temporarily transfers selected/page text and its title into the local reader, which consumes and deletes the handoff. No Chrome sync storage is used. |
| Optional host permissions | The manifest declares HTTP and HTTPS patterns so the extension can request an exact current scheme/hostname only after the user chooses the remembered-site feature. The grant enables automatic local reading assistance on that chosen site. Other sites are not automatically approved. |

Chrome's match patterns apply across ports on an approved scheme/hostname. The UI and privacy policy disclose this limit.

## Remote code

**Answer:** No, the extension does not execute remotely hosted code.

All scripts, styles, icons, reading rules, and reader UI in the extension are packaged. The service worker imports a bundled local settings script. There is no remote module loader or webcam runtime in the package. An explicit link can open the separate hosted lab as an ordinary webpage; it does not transfer page text or execute that page's code inside the extension.

## Data handling for the privacy tab

The current code handles website content locally. Do not select “no user data” merely because there is no developer upload. Chrome's [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) explicitly covers local processing and storage.

Use these concrete disclosures when completing the dashboard:

| Information | Processing, retention, and transfer |
| --- | --- |
| Website content | The hovered paragraph is read locally to select a sentence. Explicit reader import processes up to 24,000 characters and a page title. A temporary extension-session handoff is removed after consumption; abandoned handoffs are cleared on the next import or through Settings. An open reader keeps its content in memory until closed/reloaded. No page text is transmitted to the developer or a third party by the extension. |
| Personal communications in source text | A user may choose a rendered AI conversation or other message text as reading material. It follows the same local processing and temporary-retention behavior. Skim does not access an account's message API or build a message archive. |
| Local interaction | Pointer movement and the active paragraph are used while the lens is running. No interaction analytics or persistent pointer trail is collected. |
| Remembered-site information | The user's chosen scheme/hostname patterns are saved in local extension storage for automatic activation. They are a preference list, not a log of visited pages. Forgetting a site removes its setting and permission. |
| Preferences | Reading goal, compact-dock preference, and global pause are stored locally. No browser sync, account identifier, advertising profile, or sale of data is involved. |

For the current dashboard categories, review Website content, Personal communications, User activity, and Web history against these local data paths. In the history field, explain the narrow remembered-site preference list and absence of a browsing log. A publisher must make the final category choices and certifications using the dashboard's current definitions.

The extension does not separately request names, addresses, payment details, health records, precise location, authentication credentials, or cookies. User-chosen page text can itself contain sensitive information, so an absolute statement that the extension can never encounter such content would be inaccurate.

The publisher can certify the code's current limited-purpose use: no sale, no advertising use, no unrelated profiling, and no transfers of source text by the extension. The [privacy-field guide](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) requires the dashboard answers and public privacy policy to agree.

The hosted website, optional webcam lab, and optional local Jev developer server have separate disclosures on the public privacy page. Those features are not silently enabled by installing the extension.

## Reviewer test instructions

No test account, payment, API key, or camera is needed.

1. Install the candidate and open its welcome page. Start the local practice lens.
2. Rest the pointer on a sample paragraph. An original sentence becomes highlighted. Use the dock to change the reading goal.
3. Open a regular readable webpage, click the extension, and start Pointer mode once.
4. Use the optional remembered-site control. Approve Chrome's request for that site, then reload the page. The dock should return.
5. Open another site. It should not activate automatically unless separately approved.
6. Open Settings. Pause everywhere and confirm active lenses stop. Resume and forget the approved site. It should no longer auto-activate on subsequent visits.
7. Select a short passage on an ordinary page and choose Open page in Skim. Confirm a local extension reader opens with that selection.
8. Visit chrome://extensions or another protected browser page, then open the popup. The unsupported-page explanation should be understandable.
9. The webcam link opens the public lab separately. It is optional and outside the extension's pointer-mode functionality.

See docs/VALIDATION.md for observed checks and limits. These are prepared instructions, not a claim that Google has run them.

## Image packet

| Asset | Size | Intended use |
| --- | --- | --- |
| Store icon | 128×128 PNG | Required icon |
| Screenshot 01 | 1280×800 PNG | Actual browser dock and an original highlighted sentence |
| Additional screenshots | 1280×800 PNG | First-use practice or settings with clearly staged sample content |
| Small promotional tile | 440×280 PNG | Optional promotion |

The exact image filenames live in store-assets/. One to five 1280×800 screenshots are supported by this project's release gate. Use actual packaged behavior and truthful captions. The [listing documentation](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) and [image guidance](https://developer.chrome.com/docs/webstore/images) are the primary references.

## Release note

Skim Reading Lens 0.2.2 provides a compact on-page reading dock, optional remembered sites, first-install practice, and local settings. This release adds a public source repository and a concrete support channel. Page text stays local to the extension. This is an early beta and selected sentences can miss the user's intent.

## Items the publisher must finish

- Verify the configured public support email in the publisher dashboard and confirm messages reach that mailbox.
- The Google developer account and any required registration fee.
- Trader or Non-Trader selection and any requested identity verification.
- Final privacy-category choices and limited-use certifications.
- A real installed-extension smoke test of the candidate package.
- Store submission, review, and the exact approved listing URL.

No API key is needed to finish the extension's normal release.
