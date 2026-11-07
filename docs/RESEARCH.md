# Why Skim is worth an experiment

Foundational research checked on November 5, 2026; dependency packaging reviewed for v0.2.1. This is a product hypothesis and working prototype, not evidence of user benefit or demand.

## The actual problem

The user described a familiar personal behavior: scanning long AI responses and websites for meaningful words, checking whether the answer seems right, and skipping jargon. The useful product opportunity is to help the reader decide where to spend attention while keeping context accessible.

The first version asks a narrow question: can a paragraph-aware lens make an answer, an action, a detail, or a qualification easier to find? Gaze is one input. A pointer is a useful baseline and fallback. Neither attention signal tells us that the reader understood or accepted a claim.

## What the research supports

**Webcam gaze is technically available.** Brown's WebGazer estimates viewport coordinates using a webcam and runs in the browser. Its own materials state that camera video need not be uploaded. This makes a permission-based local experiment feasible. It does not establish word-level accuracy for this app, camera, lighting, or user. The project says updates are no longer guaranteed as of February 24, 2026, with community support continuing, so dependency upkeep is a real consideration.

Primary sources: https://webgazer.cs.brown.edu/ and https://github.com/brownhci/WebGazer

**A working library URL is insufficient deployment evidence.** The v0.2.1 engineering review found that WebGazer's default relative model path referred to files missing from the previous site bundle. The updated lab pins WebGazer 3.5.3 and the required face-model assets, serves them from the project host, and sets the model base path before initialization. Exact source and integrity information lives in [GAZE.md](GAZE.md) and the vendored asset records. This addresses an asset-loading failure; it does not measure gaze accuracy.

**Jev fits a bounded selection problem.** TypeSafe documents a Choice primitive that selects from a finite map of options and returns a structured choice. In Skim, those options are sentence IDs with the original sentences as descriptions. The application only accepts an ID from that supplied set. It never asks Jev to rewrite the page or issue arbitrary actions. Its probability distribution is not a measure of whether a highlighted statement is factually true.

Primary sources: https://docs.typesafe.ai/introduction and https://docs.typesafe.ai/primitives/choice

**The broader interaction has prior art.** Scim explored intelligent skimming support for scientific papers with configurable highlights. Adeliz Keith's 2023 Ontario Tech thesis, Read, Skim, Scan, explored gaze-responsive typographical cues and reported positive usability feedback but no significant effect on task performance. This is a useful warning against treating an appealing demo as proof of improved reading.

Primary sources: https://arxiv.org/abs/2205.04561 and https://vialab.ca/wp-content/publication_media/pdf/kei2023a.pdf

A 2026 Microsoft Research page also describes a controlled gaze-aware assistant study. It is a different system and task, using gaze-grounded assistance. Results from that study cannot be transferred to this lightweight webcam lens.

Primary source: https://www.microsoft.com/en-us/research/publication/from-gaze-to-guidance-interpreting-and-adapting-to-users-cognitive-needs-with-multimodal-gaze-aware-ai-assistants/

**A Chrome extension has packaging constraints.** Manifest V3 prohibits normal extension pages from executing remotely hosted JavaScript. The current release ships a fully local pointer/import extension and keeps the camera experiment in the hosted or localhost reading lab. The newly bundled lab dependencies are a prerequisite for a controlled camera implementation, but direct gaze over arbitrary websites still requires a deliberate camera surface, permission and tab lifecycle handling, calibration, and screen-to-viewport coordinate mapping.

Primary source: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3

## Design choices in the prototype

1. Keep the original words and layout. Highlight complete source sentences so qualifications remain visible.
2. Let the user choose a reading goal. A caveat, action, and supporting detail are different things.
3. Use local sentence scoring by default. English-language cues are a practical baseline, not semantic understanding or a trained personalized model.
4. Use gaze to select a region. Smooth noisy estimates and wait before switching paragraphs.
5. Measure calibration on targets that did not train the model. Decline gaze mode when the check is poor.
6. Require explicit cloud opt-in. Jev receives the focused paragraph and goal, never webcam frames or gaze coordinates.
7. Label scripted demonstrations. A simulated attention trace is useful for showing the UI, not evidence of camera accuracy.
8. Start with deliberate activation in the current tab. Version 0.2 adds optional remembered sites with explicit permissions, pause, and revocation.
9. Pin and ship the camera dependencies with the lab. A third-party asset update should be a reviewed source change, not a silent runtime change for every reader.

## Where this could fail

Calibration can be too slow, tracking can drift with head movement, and continuously changing highlights can distract readers. A local heuristic can choose the wrong sentence, especially in unfamiliar languages or technical prose. A model can also choose an irrelevant sentence. Strong emphasis can encourage a user to trust a claim without checking it. The camera setup might cost more effort than the lens saves.

Those are reasons to test the interaction before investing heavily. They do not make the portfolio experiment pointless. It already demonstrates browser interaction design, text extraction, local inference boundaries, optional typed AI decisions, and thoughtful failure handling.

## A small test with real stakes

Recruit five willing readers for exploratory feedback, not statistical proof. Prepare six short, similarly difficult passages. For each passage, ask for the main answer and a qualification that changes it. Rotate which passage appears in each condition so the same person does not answer the same passage from memory.

Compare ordinary text, pointer lens, and webcam lens. Record task accuracy, missed qualifications, time to the submitted answer, calibration time, calibration failures, and a simple distraction rating. Ask which version they would voluntarily use again. Record no face video; keep any study notes with consent.

A provisional continuation rule: the lens should not make answer or caveat accuracy worse, at least three of the five readers should choose it for another task, and camera setup should not dominate the session. These are project decisions, not established scientific thresholds. A negative result can still produce a strong honest portfolio write-up.

## A credible positioning

A reading lens for people who already skim long AI replies. The extension follows the pointer, keeps the source intact, and makes a sentence easier to notice. The separate camera lab explores whether gaze is a worthwhile input. The creative value is in a simple, useful interaction and an honest demo. No claim of inventing gaze-aware reading or proving productivity gains is needed.
