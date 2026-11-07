# Security

## Scope

The beta supports the current 0.2.x release line. Fixes should be applied to the latest source and packaged build. The project has no formal response-time commitment or paid security support.

Skim's extension processes page text locally and uses optional per-site grants. Imported text is temporary. A separate hosted webcam experiment and optional local Jev server have different data paths, documented in the privacy page and architecture notes.

## Report a vulnerability

Do not post private page contents, camera frames, credentials, or a working exploit against other people's accounts in a public issue.

Email [justfornow609@gmail.com](mailto:justfornow609@gmail.com) with the subject “Skim security report”. This is the maintainer's chosen public contact address; your message is sent privately to that mailbox. Do not open a public issue for an unaddressed vulnerability. Private GitHub advisory reporting is not assumed to be enabled.

The public development repository is [Aabdulnour/skim-reading-lens](https://github.com/Aabdulnour/skim-reading-lens). Routine installation problems can use its issue templates or the [help page](https://skim-attention-lab-anthony.aabdulnour01.chatgpt.site/help.html). Google publisher/contact verification remains separate from publishing this address. There is no automated support service or promised response time.

Include the affected version, browser version, operating system, a synthetic reproduction, the impact, and whether the problem occurs in the extension, hosted lab, or local server. Share only the minimum evidence needed to reproduce it.

## Practical protection boundaries

- The extension does not request persistent access to all sites at installation.
- Remembered sites and preferences stay in browser-local storage.
- User input must not become executable HTML or script.
- API keys belong only in the local server environment.
- The installed extension contains no remote webcam runtime.
- The hosted webcam lab loads its pinned, bundled runtime/model assets from the project host only after its consent flow. Their upstream origins, licenses, and update process are documented in docs/GAZE.md and THIRD-PARTY-NOTICES.md.
- Page content must not be used as instructions by the optional Jev adapter.
- Pause, permission removal, and camera shutdown must work when their controls are used.

A site can contain hostile content, and browser extension permissions are meaningful. Review data handling when modifying this project. No security audit, store approval, or accuracy certification is implied by the package checks.

## Maintainer response

Reproduce the report with synthetic data, assess its scope, fix the smallest affected surface, add a useful regression check, raise the extension version, rebuild the archives, and publish a clear changelog. If a store release needs withdrawal or replacement, use the publisher dashboard and communicate the affected versions through the public support channel.
