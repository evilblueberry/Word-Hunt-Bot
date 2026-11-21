# OCR regression fixtures

- `ios26_board.png`: real iPhone 15 screenshot from the failing Nov 21 run, copied from launcher runtime/output/game_board.png. Manually verified rows: SOOA / PSNE / RCUE / AHHR.
- `legacy_board.png`: existing repository game_board.png. Manually verified rows: ITCU / EHEF / ICFT / SALL.
- `start_screen.png`: existing repository images/screenshot.png. Tutorial overlay; must not be treated as a playable board.

The half-size test is a resized variant of the first screenshot, not a third independent real board. The tests run the actual EasyOCR model, requiring the installed Python requirements and model weights.
