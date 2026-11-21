# Speed experiments

All live results require actual game counter evidence. HTTP success alone is not word acceptance. No live speedup or preset has been certified yet.

## Baseline — 2026-11-21

Command: installed launcher Python, `PYTHONWARNINGS=ignore PYTHONPATH=Scripts`, warm EasyOCR reader, five reads/solves of `Scripts/tests/fixtures/ios26_board.png`, actual dictionary and current solver; inspect Selenium's encoded pointer actions.

- Reader load: 2.851163458 s (outside round).
- OCR seconds: 0.306838166, 0.170047958, 0.170186667, 0.175714917, 0.166649000. Mean: 0.197887342.
- Dictionary/filter/solve/rank seconds: 0.308779625, 0.310181375, 0.308753917, 0.307171791, 0.305569500. Mean: 0.308091242.
- Every iteration returned 184 candidate words.
- Actual Selenium encoded action: pointerMove duration 250 ms before pointerDown, another 250 ms for every later tile. Seven-tile word requests 1.75 s movement total. Already one HTTP Actions request per word; no explicit inter-word sleep.
- These are local measurements on a saved screenshot; they do not establish live latency or acceptance.

## Live validation required

Three Safe baseline rounds, two rounds per sweep setting, five consecutive stability rounds, and final launcher flow are pending. A fresh, unlocked, playable game and accessible Appium server are required.

## Baseline round 1

Command: `Scripts/main.py --label baseline-1`, launcher Python with actual device configuration, original Selenium gestures; 75-second submission budget. Evidence: `tests/output/speed/runs/20261121T180600.459426Z-baseline-1/`.

- Board: LTNM / IIME / IYSA / HTFC.
- Screenshot: 0.404171 s; OCR: 0.308616 s; solve: 0.294790 s; planning including window-size request: 0.429684 s.
- Attempted 27; displayed WORDS counter 0 → 27; acceptance 100%. Displayed SCORE 0000 → 32312 (after.png visually checked). Initial OCR reported `SCORE:OOOO`; numeric suffix normalization was added after this measurement; original report retains null initial score.
- Measured round segment: 76.917978 s. Gesture calls ~2.3–3.5 s, gaps ~1 ms. Safe gestures unchanged.
- Appium/device discovery initially reported iPhone unavailable; user connected/unlocked it and opened a fresh round. Subsequent devicectl check confirmed connected.

## Offline trie experiment

Command: actual installed launcher Python, five legacy and trie solves per board, real Scrabble dictionary, assert exact word-set equality. One-time trie build: 0.730087 s, outside timed round.

| Board | Words | Legacy mean s | Trie mean s | Local solver ratio |
|---|---:|---:|---:|---:|
| SOOA/PSNE/RCUE/AHHR | 184 | 0.364274 | 0.002543 | 143.27× |
| ITCU/EHEF/ICFT/SALL | 134 | 0.321888 | 0.002340 | 137.54× |
| QU I T E / A R S N / L O P B / C D G H | 275 | 0.557094 | 0.019128 | 29.12× |

An initial parity assertion exposed two-letter dictionary entries omitted by the candidate trie; restored all entries and reran with exact parity. Live attempt planning will filter invalid two-letter game words separately and explicitly. These local solver ratios are not full-round/device speedups.

## Candidate gestures

Single configuration file: speed_config.json. Safe preserves every 250 ms move. Fast/Max are candidates; until live verification they fall back to Safe unless an experiment explicitly requests candidate settings. Pure payload test compares Safe encoding with Selenium's actual encoder. New words lift the finger before repositioning; interpolation adds points without changing total path duration.

Appium docs/source inspection: drag duration and velocity commands accept only two endpoints; touchAndHold and directional swipe do not express a general path through all Word Hunt tiles. Replacing an arbitrary word path with those commands would change its letters. Keep W3C multi-point paths for comparisons. Installed WDA exposes POST /actions, allowing a later direct-WDA transport comparison without changing the touch path.

## Baseline rounds 2 and 3

Commands: `Scripts/main.py --label baseline-2` and `--label baseline-3`, same original gesture execution and setup as round 1. Per-word raw timings and before/after screenshots retained under tests/output/speed/runs.

| Round | Board | Segment s | Attempted | Accepted | Score |
|---|---|---:|---:|---:|---:|
| baseline-2 | FMTT / HAGO / EANS / ELDO | 76.408216 | 27 | 27 | 30835 |
| baseline-3 | RUAE / RTOE / TGIS / SOFN | 77.420695 | 30 | 27 | 21133 |

Aggregate: 81/84 = 96.4286% displayed acceptance, mean segment 76.915629 s, mean accepted 27, mean score 28093.3333. Acceptance floor within 2 percentage points = 94.4286%. Rejections may include dictionary mismatches; score counters alone cannot distinguish those from gesture loss. Comparisons are across random boards, not matched-board causal estimates. No setting passes solely on command success.

Offline reproducibility command added: `Scripts/benchmark_speed.py`. Raw five-iteration samples saved in tests/output/speed/offline.json; exact real OCR labels and word parity asserted. On this later run, local solver means 0.399293 vs 0.002378 s and 0.282512 vs 0.001404 s; warm OCR 0.251313 and 0.175201 s. Timing variance is preserved in raw samples.

## Rejected experiment: settings not passed to executor

Command: `Scripts/main.py --label sweep-150-0-r1 --preset fast --experimental --swipe-ms 150 --gap-ms 0 --batch-size 1 --solver legacy`.

Payload requested_ms showed 1750 ms for seven-tile words, revealing main recorded tuning without passing it to run_bot. The attempt was therefore actually another Safe control, not a valid 150 ms experiment. Retained original report unchanged and added measurement_note.json excluding it from the candidate sweep. Observed 28/28 accepted, score 28326, segment 75.976509 s. Fixed argument forwarding, and launched the separately labeled `sweep-150-0-r1-corrected` experiment. No speedup is attributed to the invalid attempt.

## 150 ms / zero gap, repeat 1

Command: same experimental flags, label `sweep-150-0-r1-corrected`. Actual payload is 170 ms including 10 ms press and release dwells. One request per word; original solver; default WDA settings.

- Board: EMDT / BNCA / EROD / IHHO.
- Segment: 76.847712 s; 46 attempted, 43 displayed accepted, 30800 points, acceptance 93.4783%.
- Calls ~1.4–2.0 s despite 0.17 s requested gesture timeline. Below the 94.4286% acceptance floor on this first board; not approved. Repeat required before deciding next setting. No final preset selected.
- Unit suite after adding instrumentation/gesture builder/trie: 20 tests passed with actual EasyOCR and dictionary. Safe payload equals Selenium's actual encoder; trie returns identical words on tested boards, including QU. Launcher lint and scoped UI detector passed.

## User-directed next experiment: 155 ms and intermission latency

User observed quick swipes followed by about one second of waiting, and requested 155 ms movement while reducing intermission. Measured client gaps are ~1 ms, so the visible pause is inside Appium/WDA request handling. Installed WDA source `XCUIApplication+FBTouchAction.m`, fb_performW3CActions, confirms a call to fb_waitUntilStableWithTimeout using animationCoolOffTimeout after event synthesis. Next experiment: same one-word request, 155 ms movement, zero gap, original solver, disable waitForIdleTimeout and animationCoolOffTimeout. Restore prior WDA settings after each experiment. No batching or direct transport in this first comparison.

## 155 ms / zero gap / idle and animation waits disabled

Command: `Scripts/main.py --label idleoff-155-0-r1 --preset fast --experimental --swipe-ms 155 --gap-ms 0 --batch-size 1 --solver legacy --settings '{"waitForIdleTimeout":0,"animationCoolOffTimeout":0}'`.

- Actual settings readback: waitForIdleTimeout 10 → 0; animationCoolOffTimeout 2 → 0. Both restored after the experiment.
- Board: THOW / NMSU / ECTO / ELNS. Attempted 44; accepted 44; score 37351; acceptance 100%.
- Segment 77.122913 s; process including model/session/setup 93.318943 s; measured since Start preparation 80.307279 s. The latter includes the pre-Start screenshot/tap command, so it is an upper bound for exact countdown age.
- Mean request 1.682897 s; mean client gap 0.003983 s. Disabling the waits did not remove the ~1-second visible intermission. No claim of an idle-setting speedup.
- Next isolate batching at the same 155 ms/zero gap/idle-off/legacy-solver settings, four words per request. Added deadline guard based on observed batch latency to keep a large final batch from running after expiration.

## Four-word batches / 155 ms / zero gap — rejected

Command: `Scripts/main.py --label batch4-155-0-r1 --preset fast --experimental --swipe-ms 155 --gap-ms 0 --batch-size 4 --solver legacy --settings '{"waitForIdleTimeout":0,"animationCoolOffTimeout":0}'`.

- Board: OUAR / NALT / SETD / IDES. 32 attempted; 12 accepted; score 17585; acceptance 37.5%. Segment 67.485921 s (deadline guard avoided another oversized final batch).
- Mean batch request 7.903422 s, roughly 1.98 s per word. Not a demonstrated latency benefit, and acceptance unacceptable. Reject zero-gap batching.
- Next change only gap to 50 ms to allow separate lift/down events on different display frames. Actual game behavior, not HTTP success, determines whether this is viable.

## Four-word batches / 155 ms / 50 ms gap — rejected

Command: same batching flags, label `batch4-155-50-r1`, gap changed to 50 ms. Board SNSM / DDEN / AOOT / HHET. Attempted 36, accepted 29, score 33853, acceptance 80.5556%. Segment 67.787950 s. Mean batch request 7.201232 s. Acceptance improved but remains below baseline tolerance; no preset promotion. Rejected settings were not repeated as stability candidates.

## Screen-coordinate WDA hypothesis

Source inspection: every W3C pointer move builds an XCUICoordinate relative to the active application, then resolves its screenPoint. A Word Hunt plan already has absolute screen points. Hypothesis: per-point application-coordinate resolution contributes to latency. Prepared a reversible opt-in path in FBTouchActionCommands, using the same XCPointerEventPath/XCSynthesizedEventRecord APIs as WDA, validating portrait orientation, coordinate bounds, touch sequence and duration, and avoiding repeated coordinate lookups. Standard /actions behavior remains unchanged without the explicit flag. Python DirectWDA requires a positive acknowledgement so an old WDA build cannot be mislabeled as this experiment. Source backup is retained next to the patched file. No performance claim until compiled/live measured.

## User-directed all-words request

User requested all words in one batch and 60 ms between batches. Interpreted as a 60 ms lift gap between words within the one all-words request, and stated that interpretation before execution. Implemented batch_size `all`, preserving order and lift events; timeline budget trims the lowest-priority tail if all words cannot fit before expiration. At 155+20+60 ms per word, 379 words would require ~89 seconds before overhead, exceeding a round.

- Unit tests: all-words mode emits one request, includes a 60 ms pause after each lift except the last, and respects a timeline budget. Five speed-specific tests passed, including exact solver parity and Safe encoding.
- Installed reversible helper using Scripts/patch_wda_speed.py with approval; original FBTouchActionCommands.m retained as .wordhunt-original.
- Initial manual compile used the upstream default bundle ID and failed provisioning; reran with PRODUCT_BUNDLE_IDENTIFIER=com.malcolm.wordhuntbot.wda. Compiler then caught an undeclared category wrapper; corrected to the declared FBXCTestDaemonsProxy synthesizeEventWithRecord:error: API. No device gestures were sent by these failed builds.
- Recompilation uses the existing custom bundle/profile, preserves Appium 4.0.0 / driver 13.5.0 / WDA 17.0.12, and is in progress. Added newCommandTimeout 180 seconds so Appium does not expire its session during a long direct-WDA event request.

## All-words screen-coordinate result

The corrected WDA helper compiled successfully. Appium rebuilt and installed it with useNewWDA; session startup including that rebuild took 201.467875 seconds, outside the game timer. Device lock-state check showed passcodeRequired false and unlockedSinceBoot true; Developer Mode was enabled. Read-only launcher/Xcode UI inspection found no outstanding prompt.

Command: `Scripts/main.py --label all-155-60-screen-r1 --preset fast --experimental --swipe-ms 155 --gap-ms 60 --batch-size all --solver legacy --transport wda-screen --settings '{"waitForIdleTimeout":0,"animationCoolOffTimeout":0}' --rebuild-wda`.

- Evidence directory: tests/output/speed/runs/20261121T183332.417596Z-all-155-60-screen-r1/.
- Board: TANT / YZWF / UDAR / EOEN.
- All 126 planned words scheduled in one request; no words omitted for deadline.
- Game counter accepted 123/126 (97.6190%), score 41773. Baseline aggregate was 96.4286%.
- Requested event timeline: 29.550 s. Actual native request elapsed: 25.260294 s. These are distinct measurements; native playback does not exactly match the requested timeline.
- Measured segment: 27.985982 s; elapsed since Start preparation: 30.637139 s. Process including the one-time rebuild/model/setup: 243.584482 s.
- Accepted throughput: 123/27.985982 = 4.395 words/s, versus baseline 81/(76.917978+76.408216+77.420695) = 0.351 words/s, about 12.52× in these different-board samples. Not a matched-board causal estimate.
- Positive screen-coordinate acknowledgement required by the transport; an old WDA cannot silently count as this implementation.

## Launcher update requested by user

User explicitly waived the five-round stability check and requested the most recent successful all-words test in the launcher. No additional stability or sweep rounds are claimed.

- Fast config now exactly matches the successful test: whole-path 155 ms, 10 ms press/release dwell, gap 60 ms, batch all, no intermediate points, original solver, direct screen-coordinate WDA, idle/animation settings zero. `launcher_enabled` expresses the user's release choice separately from full stability verification.
- Electron now passes the selected preset to Python, prepares the WDA helper if needed, and logs the actual mode. Added a one-time settings migration selecting Fast, preserves subsequent Safe choices, includes speed_config.json in packaged resources, and updates the window title to Word Hunt Bot — All Words.
- Safe still matches original Selenium pointer encoding. Added a regression test that normal Fast loading resolves to the latest tested settings rather than falling back to Safe.

### Launcher update verification

- `npm run lint && npm run build` in launcher: passed; new Electron bundle built.
- Actual running Electron UI inspected: window title `Word Hunt Bot — All Words`, Run Bot view selected `Fast — all words, 155 / 60 ms`. No game was started during UI verification.
- Direct preset check returned `Launcher mode: fast fallback: False`, path 155 ms, gap 60 ms, batch all, transport wda-screen.
- Final Python suite: `Ran 22 tests in 6.935s ... OK`, using the installed launcher runtime, actual OCR models and dictionary. `git diff --check` passed.
- Local Appium status check after the Electron reload returned connection refused (exit 7): old server stopped, so no orphan port conflict. Run bot will start Appium automatically through the updated launcher.
- No five-round stability test performed, at the user's explicit request. The running development launcher is updated; installed distributions still require a rebuild/reinstallation to receive repository edits.
