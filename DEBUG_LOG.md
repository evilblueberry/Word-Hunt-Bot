# Debug log

This log records the recovery work for the Word Hunt bot.

## 2026-11-20

### Initial repository and environment inspection

- Command: `git status --short`, read `README.md`, `FIRST_TIME_SETUP.md`, `requirements.txt`, launcher source, and Python scripts.
- Result: The repo has a React/Electron launcher, Python/Appium bot, OpenCV/EasyOCR recognition, and solver. Existing worktree changes were already present before this recovery; they are preserved.
- Command: `sw_vers; xcode-select -p; xcodebuild -version; xcodebuild -checkFirstLaunchStatus; xcrun xctrace list devices; xcrun devicectl list devices; node --version; npm --version; python3 --version; appium --version; appium driver list --installed; security find-identity -v -p codesigning`.
- Result: macOS 15.2, Xcode 16.0, Node 23.7.0, npm 11.5.2, Python 3.13.2, global Appium 2.19.0. `xcodebuild -checkFirstLaunchStatus` could not create its Instruments cache under the sandbox; `devicectl` timed out waiting for CoreDevice; global Appium could not use `/Users/malcolm/.appium`; codesigning reported `0 valid identities found`.
- Result: No physical-device UDID was returned by the device commands, and no valid Apple Development identity was available in the captured output.

### Existing deterministic checks

- Command: `PYTHONPATH=Scripts python3 -m unittest discover -s Scripts/tests -v`.
- Result: Failed before collecting tests because `Scripts/tests` was not importable.
- Command: `npm run lint; npm run build` in `launcher`.
- Result: Both passed. Vite produced the launcher bundles successfully.

### Recovery changes and verification

- Added `Scripts/config_validation.py`, `Scripts/preflight.py`, importable test package metadata, configuration tests, and `setup.sh`.
- Updated launcher preflight to validate Team ID, signing ID, full UDID, unique WDA bundle ID, certificate validity, both device inventories, and to show exact diagnostics in the UI.
- Updated WDA test capabilities to allow device registration/provisioning updates and stopped presenting the generic Xcode-only explanation when the actual stderr is available.
- Command: `PYTHONPATH=Scripts python3 -m unittest discover -s Scripts/tests -t . -v`.
- Result: `Ran 8 tests ... OK`.
- Command: `cd launcher && npm run lint && npm run build`.
- Result: ESLint passed; TypeScript/Vite build passed and produced launcher bundles.
- Command: `PYTHONPATH=Scripts python3 Scripts/preflight.py --team-id bad-team --signing-id 3285Q523PM --udid 1234 --wda-bundle-id 'not a bundle'`.
- Result: Failed with four specific messages: invalid Team ID, signing ID is a certificate suffix/Team ID, truncated UDID, and invalid reverse-DNS WDA bundle ID. Environment probes also reported `0 valid identities found`, xctrace cache permission failure, and CoreDevice initialization timeout.
- Command: valid-shape preflight with Team ID `287MYRCJ37`, signing ID `Apple Development`, UDID `00008120-000C12345678901E`, and WDA bundle `com.malcolm.wordhuntbot.wda`.
- Result: Environment probes did not complete within the command timeout; no device or signing identity has been established.
- Command: direct validation cases for bad Team ID, bad signing ID, and truncated UDID; `git diff --check`.
- Result: All three invalid cases failed with their intended specific messages; `git diff --check` passed.

### Signing information confirmed in Xcode UI

- Evidence: Xcode Signing & Capabilities shows `Malcolm Ripp (Personal Team)` and signing certificate `Apple Development: Malcolm Ripp (3285Q523PM)` with an Xcode Managed Profile.
- Conclusion: The correct `xcodeOrgId`/Apple Team ID is `3285Q523PM`. The correct `xcodeSigningId` is `Apple Development`. The previously supplied `287MYRCJ37` was not the Team ID for this Personal Team.

### Physical device preflight passed

- Evidence: `xcrun xctrace list devices` and `xcrun devicectl list devices` both report physical `Malcolm’s iPhone` with UDID `00008120-000C65C00CA2201E`; `devicectl` reports state `connected`.
- Evidence: `security find-identity -v -p codesigning` reports `Apple Development: Malcolm Ripp (3285Q523PM)` and `1 valid identities found`.
- Command: `PYTHONPATH=Scripts python3 Scripts/preflight.py --team-id 3285Q523PM --signing-id 'Apple Development' --udid 00008120-000C65C00CA2201E --wda-bundle-id com.malcolm.wordhuntbot.wda`.
- Result: `config_errors` is empty; xcode-select, xcodebuild, xctrace, devicectl, and signing identity checks all passed.

### WDA build failure captured from launcher

- Evidence: Appium created a real-device session and found the iPhone, then invoked `xcodebuild` against WDA.
- Root cause: WDA's generated project failed signing with `No Account for Team "3285Q523PM"`, `No signing certificate "iOS Development" found`, and `No profiles for 'com.malcolm.wordhuntbot.wda.xctrunner' were found`.
- Secondary environment error: CoreDevice reported error 1005 while creating bookmark data for the built app; this occurred after the signing failure and is not the primary cause.
- Dependency drift: launcher was using Appium 2.19.0 and XCUITest driver 9.2.4 on Xcode 27.2/iOS 26.6.2. Updated source pin to Appium 4.0.0 and XCUITest driver 13.5.0, and changed dependency installation to replace stale driver versions.
- Verification: `npm run lint && npm run build` passed after the dependency pin change.

### Appium upgrade attempt

- Evidence: dependency install failed before WDA with `npm error code ERR_INVALID_ARG_TYPE` and repeated `EBADENGINE` warnings because Appium 4 requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`, while the machine has Node `v23.7.0`.
- Evidence: the isolated runtime package still contained stale dependencies `appium@2.19.0` and `appium-xcuitest-driver@9.10.5`.
- Fix: launcher now rewrites the isolated runtime manifest to only `appium@4.0.0`, installs with `--legacy-peer-deps`, and then installs exact `xcuitest@13.5.0`; setup.sh was updated likewise.
- Verification: launcher lint and build pass after this fix.

### Post-upgrade WDA attempt

- Evidence: launcher reports Appium and XCUITest driver ready; Appium creates a real-device session and invokes Xcode successfully.
- Result: dependency upgrade succeeded, but WDA still exits with code 65.
- Remaining root cause: Xcode reports `No Account for Team "3285Q523PM"`, `No profiles for 'com.malcolm.wordhuntbot.wda.xctrunner' were found`, and `No signing certificate "iOS Development" found` while building the generated WDA project. This is now a WDA target-level signing/profile issue, not device discovery or Appium startup.

### Team ID correction and prevention

- User-provided certificate evidence: `OU=287MYRCJ37`, while `CN=... (3285Q523PM)` is only the certificate identifier.
- Fix: updated the saved launcher config at `~/Library/Application Support/launcher/wordhunt_config.json` to `287MYRCJ37`; launcher defaults and migration now repair the legacy wrong value automatically.
- Fix: preflight now detects certificate OU Team IDs, rejects the certificate CN suffix, and exposes a detected Team ID correction action in the launcher.
- Verification: Python tests pass (`Ran 9 tests ... OK`); launcher lint/build pass; `git diff --check` passes.

### 2026-11-21: OCR recovery after successful WDA/session

- Read the latest user-pasted launcher log at attachment b3fd2d58-c482-462e-85be-3643e5177206. It proves successful WDA startup and `POST /session 200`, followed by OCR failure with four unknown cells.
- Inspected `runtime/output/game_board.png` with the image viewer and read `Scripts/main.py`, `Scripts/modules.py`, and existing geometry tests. Root cause: the old fixed crop `(150,1100,1030,2000)` splits tiles at the wrong positions; swipe origin `(160,1130)` also differs from OCR geometry.
- Ran installed launcher Python imports; OpenCV 4.13.0 and EasyOCR import successfully. Viewed existing repository screenshots: game_board.png is another real board, images/screenshot.png is the tutorial, board_after_swipe.png contains Messages previews.
- Added `Scripts/board_recognition.py`: detect and validate 16 regular wooden tile rectangles, threshold each interior to isolate its letter, bypass EasyOCR text detection, retry wider padding on low confidence, and reject uncertain recognition before swiping. Save cell crops, confidence JSON, and labeled overlay.
- Replaced live bot fixed crop/origin with detected centers scaled independently on both axes. Added saved word/coordinate plan, dry-run mode without taps/swipes, pre-round OCR initialization, CPU recognition-only model initialization, and explicit printed grid.
- Copied two real screenshots and the tutorial into `Scripts/tests/fixtures`, with manually verified labels documented there. A resized variant is tested separately and is not counted as an independent real screenshot.
- Initial real OCR command against the launcher screenshot returned exact grid `SOOA / PSNE / RCUE / AHHR`. The older board also read exactly `ITCU / EHEF / ICFT / SALL`.
- First full test run exposed low-confidence N on the half-size image. Added wider-padding recognition retry; confidence threshold remains 0.5. Reran the actual EasyOCR model tests successfully.
- Ran `PYTHONWARNINGS=ignore PYTHONPATH=Scripts '/Users/malcolm/Library/Application Support/launcher/runtime/venv/bin/python' -m unittest discover -s Scripts/tests -t . -v`: 16 tests passed, including both real boards, resized recognition/point scaling, and tutorial/no-board rejection.
- Ran a real offline OCR → dictionary → solver → coordinate conversion command using the installed launcher environment: 184 words found; top words harpooneer, harpooner, harpoons, spooner, harpoon. Validated their adjacency/no-reuse paths through path_to_coordinates. No device gestures sent.
- Ran `git diff --check`: passed. Local `curl --max-time 3 -s http://127.0.0.1:4723/status` returned exit 7 (no accessible server); no fresh live-game verification performed in this pass.

### Updated launcher: physical device unavailable

- Read attachment 25de0caa-b0f7-4ff0-9e37-685a89fa9dd5: Fast/all-words settings and Appium 4 loaded correctly. Session creation failed before WDA with Unknown UDID and no tunnel registry.
- Read installed driver ConnectedDevicesClient: missing tunnel registry is normally tolerated; real-device discovery combines tunnel and USB/host results. No sudo tunnel command run.
- Ran `xcrun devicectl list devices` outside the sandbox: iPhone is remembered but `unavailable`; no tunnel-creation process was running.
- After user reconnected/unlocked, ran structured CoreDevice inventory: pairingState paired, developerModeStatus enabled, tunnelState unavailable, ddiServicesAvailable false, lastConnectionDate unchanged at 18:40 UTC. This is not an active connection.
- Ran USB-plane inspection plus `xcrun devicectl device info lockState --device 00008120-000C65C00CA2201E`: no iPhone USB entry; CoreDevice error 4016, no assertable trusted-connectivity state.
- Added Scripts/device_connection.py and shared it with launcher preflight/start and bot startup. Remembered-but-unavailable devices now fail with USB data cable/Trust/Allow Accessory/Finder instructions before OCR/Appium session creation. A connected device also supplies platformVersion to avoid the empty-capability warning.
- Actual new probe returned connected=false, state=unavailable, exit 2 with the explicit reconnect/data-cable/Trust message. No game or sudo command was run.
- Verification: installed launcher Python unit suite `Ran 25 tests in 6.514s ... OK`; launcher lint and production/Electron build passed.

