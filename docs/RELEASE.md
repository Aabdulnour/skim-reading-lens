# Release Skim Reading Lens 0.2.2

This packet prepares an installable beta and a Chrome Web Store submission. It does not create a publisher account, accept legal declarations, pay a registration fee, or obtain Google's approval.

## Distribution decision

Use the Chrome Web Store for ordinary users. Chrome handles installation and normal updates through the store. Keep the unpacked ZIP for contributors and early testers, with its manual-update limitation visible. Keep the live reading lab available without installation.

The extension is the primary product. Its compact dock lives at the top of a browser page. A systemwide Mac notch companion is a separate future application, with its own permissions, packaging, update mechanism, signing, and maintenance. The v0.2.2 downloads do not contain a Mac application.

The canonical development repository is [Aabdulnour/skim-reading-lens](https://github.com/Aabdulnour/skim-reading-lens). It provides the source, issues, and pull requests. The project site hosts the demo and downloadable builds. The sanitized source ZIP is another complete distribution format and can be rebuilt without deployment credentials.

## Files in this release

| File | Use |
| --- | --- |
| skim-chrome-store-v0.2.2.zip | Upload this to the Chrome Web Store |
| skim-extension.zip | Unzip and load in Chrome Developer mode for a beta test |
| skim-source.zip | Read, modify, and rebuild the complete GPL project |
| skim-release-kit-v0.2.2.zip | All store materials and source in one handoff |
| SHA256SUMS | Verify the four ZIPs |

The store upload has manifest.json at its root, as required by the [store preparation guide](https://developer.chrome.com/docs/webstore/prepare). The source ZIP is deliberately a different artifact.

## Local release command

Requires Node.js 20+ and Python 3:

    npm run release

This runs behavior tests, packages fixed-metadata ZIPs, and checks artifact parity, versions, least-privilege permissions, executable dependencies, icon and screenshot dimensions, source exclusions, and checksums. No dependency installation or paid CI service is required.

After any source, image, or documentation edit, rebuild before uploading. The checker rejects stale artifacts. Its 8 MiB extension limit is this project's accidental-bloat guard, not a Chrome Web Store rule.

For the publisher-contact check:

    npm run release:check -- --submission

The configured public support address is justfornow609@gmail.com. This check verifies the package's contact configuration; it cannot verify mailbox delivery or Google's account/contact verification. It does not replace account setup, policy review, a manual installed-extension test, or the store's review.

## The publisher steps

1. **Use the Google account that should own the product.** Open the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Register if needed, enable the required two-step verification, choose the publisher name, and verify the contact email. Google documents a one-time registration fee; an April 2026 Chrome announcement specifies US$5. Complete payment only in Google's own account flow.
2. **Verify the contact and choose publisher status.** Use justfornow609@gmail.com for public support and verify it in Google's publisher flow. Keep supportEmail in dist/release-config.js and the help/privacy pages consistent. A publisher's login account and public support mailbox can serve different purposes. The account holder must choose Trader or Non-Trader based on their circumstances and complete any requested verification. These declarations cannot be inferred from the code.
3. **Do the installed-extension smoke test below.** Automated tests and a website preview do not establish Chrome's real permission-prompt behavior. Record the browser/OS/version and actual result in docs/VALIDATION.md.
4. **Build the final packet.** Run the release command after the contact and any fixes are in place. Use the resulting store ZIP, images in store-assets/, and prepared fields in docs/STORE-LISTING.md.
5. **Create a new dashboard item and upload the store ZIP.** Confirm the detected name, version, short description, and icons. Complete listing, privacy, distribution, and test-instructions fields. Review each data-use certification yourself.
6. **Submit for review.** A public beta is the intended distribution. If an initial limited test is desired, Unlisted has a direct install URL but still goes through review. Google's review timing varies; do not advertise a guaranteed launch day before approval.
7. **Connect the approved install URL.** Copy the exact live store listing URL into chromeWebStoreUrl in dist/release-config.js and publish the website update. This switches the site from developer download guidance to the real consumer installation route. Verify the link while signed out.
8. **Release and observe.** Use store-provided install/review statistics and direct user feedback. The extension contains no custom telemetry. Fix concrete failures, increase the version, and upload the replacement to the same item.

Account, fee, contact, and status sources: [registration](https://developer.chrome.com/docs/webstore/register), [account setup](https://developer.chrome.com/docs/webstore/set-up-account), [two-step verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification), [2026 fee reference](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard), [Trader verification FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq).

Publishing sources: [publish](https://developer.chrome.com/docs/webstore/publish), [distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution), [review process](https://developer.chrome.com/docs/webstore/review-process).

## Installed-extension smoke test

Use a normal desktop Chrome profile or a separate test profile. Do not run two Skim copies at once. This is the short release acceptance test, not a request to re-test every unit function manually.

| Scenario | Expected result |
| --- | --- |
| Install the unpacked candidate | One welcome page opens and the product name/icons are correct |
| Start practice on the welcome page | The actual lens highlights an original sentence |
| Open an ordinary article and start once | Dock appears; page layout and source wording remain intact |
| Move the pointer out of the page, scroll, then return | The sentence clears while the pointer is outside and returns only after a fresh paragraph focus |
| Change reading goal | The lens selects an exact original sentence using the chosen local rule; no remote request or login is required |
| Reject the site's optional permission request | One-off use continues; the site is not remembered |
| Approve remembering one site | Reloading and revisiting that site restores the dock |
| Visit another site | It does not automatically receive a dock or a permanent grant |
| Open a fresh tab on an approved site after restarting Chrome | Remembered behavior returns when global pause is off |
| Pause everywhere | Existing lenses stop and automatic activation stays off |
| Resume | Future eligible pages can activate again |
| Forget a site | Its registered script and optional grant are removed; it no longer auto-activates |
| Type in a page input or editor | Text entry continues normally without reading or shortcut interception |
| Close the current lens with Escape | Only the current lens closes; the page still works |
| Import selected text | The local reader receives that selection and consumes its temporary handoff |
| Open settings and clear waiting imports | Abandoned handoffs disappear; an already open reader remains in memory |
| Try a protected browser page | A useful explanation appears instead of a broken loading state |
| Open the camera lab | A separate page opens; no page text is transferred and camera remains off until consent |

Test a rendered ChatGPT response and one article that contains nested inline formatting. For a streamed answer, confirm the lens updates when the hovered paragraph changes. Record any unsupported page structure honestly.

The camera feature needs a separate human trial. Do not market gaze accuracy, faster reading, or better comprehension based on passing the extension tests.

## Continue on a Mac with Claude Code

Use the canonical `Aabdulnour/skim-reading-lens` checkout. The next useful milestone is a real installed-extension session and a real-person webcam trial. Do not replace those observations with another model-only compatibility run.

Give the coding agent this task:

```text
Read AGENTS.md, docs/VALIDATION.md, docs/RELEASE.md and docs/GAZE.md in this checkout.
Preserve uncommitted work and confirm the current branch and remote before updating.
Run npm run release and npm run release:check -- --submission.
Start the local app with npm start only if the project server is not already running.
Guide Anthony through loading extension/ in desktop Chrome and perform the installed-extension checklist in docs/RELEASE.md.
Use a synthetic article and a rendered ChatGPT response. Check changing goals, streamed text, selected-text import, Copy pins and Download .txt, remembering one site, denial fallback, pause, forgetting and Escape.
Use the separate web lab for a physical-camera trial. Anthony must make the camera choice and look at the targets.
Record calibration and held-out validation results, whether the lens follows the intended paragraphs, and whether the camera indicator turns off after Stop, changing tabs, and closing the lab.
If a concrete bug appears, fix it, add only the relevant regression coverage, and rerun the affected checks.
Record the actual browser and OS, observations, fixes and remaining gaps in docs/VALIDATION.md.
Keep the webcam accuracy thresholds and camera shutdown protections intact. Do not claim human accuracy from mocked tests.
Return the exact source commit, test results, installed-browser observations and webcam verdict.
```

The prepared store upload and listing are usable after this check. Account registration, agreements, any registration payment, and publisher attestations belong to the account holder; a coding agent must not report them completed from package tests.

## Store images and wording

Use the prepared 128×128 icon and at least one 1280×800 screenshot. The packet can include up to five screenshots and an optional 440×280 promotional tile. The [current listing guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) describes the required fields; [image guidance](https://developer.chrome.com/docs/webstore/images) describes quality and padding.

Keep screenshots representative of the packaged extension. Label staged sample text clearly. Do not show a hosted camera demo as if it were gaze tracking inside arbitrary websites.

The name Skim is also used by other software. The descriptive title “Skim Reading Lens” identifies this beta, but this work did not clear a trademark or guarantee unique store discovery. Choose a longer-term name before investing in a domain or paid promotion if desired.

## Public source and release publication

Develop in [Aabdulnour/skim-reading-lens](https://github.com/Aabdulnour/skim-reading-lens), with main as the integration branch. Clone it once for local work. Contributors can fork it and submit focused pull requests. AGENTS.md and CLAUDE.md describe the same project workflow for coding agents.

The website's deployment checkout is a separate publishing surface. Its private hosting identity and Git history must not be mirrored into the public repository. When reconciling work between the two, transfer the reviewed publishable files, preserve the deployment configuration in its own checkout, and record which public source commit the deployment contains. Do not treat a successful GitHub push as evidence that the website was updated.

For a release:

1. Review the intended public diff and run npm run release in the release checkout. Resolve a failed check before uploading its artifacts.
2. Commit the source, changelog, and release documentation on the intended branch. Confirm that the pushed commit contains the tested source.
3. Create the version tag for that commit and publish release notes describing the actual changes and remaining limits. Do not claim a tag or GitHub Release exists until it is visible in the repository.
4. Attach skim-extension.zip, skim-source.zip, the versioned store ZIP and release kit, and SHA256SUMS to the [repository's Releases page](https://github.com/Aabdulnour/skim-reading-lens/releases). Use files from the same build, without regenerating one artifact independently.
5. Publish the corresponding website update and compare the live download checksum with that release's SHA256SUMS. Keep sourceRepositoryUrl set to the real repository URL. Set chromeWebStoreUrl only after a real store listing is available.

The source export omits .openai/ hosting identity, Git history, local secrets, and generated download archives. Its explicit allowlist includes the contributor guidance and tests. No GitHub Actions workflows are configured, so publishing this source does not itself create recurring CI jobs.

Use the private email channel in SECURITY.md for sensitive reports. GitHub private vulnerability reporting can be enabled later, but the documentation must not claim it is active before the setting is checked.

## Updates and rollback

Keep the same Chrome Web Store item and extension ID. Increase both package.json and extension/manifest.json versions, write the changelog, run the release command, repeat the affected installed-extension checks, and upload the new store ZIP. Store policy can require another review.

Chrome normally manages updates for store-installed extensions. Offline devices, enterprise policy, and browser settings can delay them. Users of the unpacked beta still need a manual reload.

If a version has a serious defect, stop promoting it. Prepare a fixed package with a higher version number, because extension versions cannot simply decrease. The publisher can use the dashboard's available withdrawal/unpublish controls while a replacement is prepared. Keep the source and notes of affected releases so behavior can be reproduced.

## What remains a product hypothesis

The package can ship a reading lens. It does not establish that people want to keep it, that keyword emphasis improves comprehension, or that webcam calibration feels effortless.

A useful first pilot is five to ten people who regularly skim long replies. Use the same short task for each person:

1. Give them the installation page and ask them to reach their first useful highlight without coaching. Record completion and where they get stuck.
2. Ask them to remember one site, close and reopen it, then pause and forget it. Record whether they understand when the lens will return.
3. Use two comparable synthetic passages, one with the lens and one without it. Alternate the order between testers. Ask for the answer and its caveat, and record correctness as well as time. A small pilot is directional evidence, not proof of a general reading-speed benefit.
4. Let them use the extension for several days, then ask whether they returned voluntarily, whether the dock interrupted them, and which sentence choice was least useful.
5. Collect feedback through a public issue with synthetic content or the private support mailbox. Do not collect camera frames, private chats, or browsing logs as a default part of the pilot.

Fix repeated installation or interruption failures before adding another required setup step. Run the separate webcam device trial in docs/GAZE.md before investing in gaze across arbitrary pages. A native Mac companion should follow a demonstrated need that the browser implementation cannot meet.

That evidence decides whether the next investment should be better text selection, lower-friction camera input, or a separate Mac companion.
