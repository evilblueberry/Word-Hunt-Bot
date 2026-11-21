#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PYTHON_BIN=${PYTHON_BIN:-python3}
RUNTIME_DIR="$ROOT_DIR/.runtime"

mkdir -p "$RUNTIME_DIR"
if [ ! -x "$RUNTIME_DIR/venv/bin/python" ]; then
  "$PYTHON_BIN" -m venv "$RUNTIME_DIR/venv"
fi
"$RUNTIME_DIR/venv/bin/python" -m pip install --upgrade pip setuptools wheel
"$RUNTIME_DIR/venv/bin/python" -m pip install -r "$ROOT_DIR/requirements.txt"

mkdir -p "$RUNTIME_DIR/appium"
if [ ! -f "$RUNTIME_DIR/appium/package.json" ]; then
  (cd "$RUNTIME_DIR/appium" && npm init -y)
fi
(cd "$RUNTIME_DIR/appium" && npm install --save-exact --legacy-peer-deps appium@4.0.0 && npx appium driver uninstall xcuitest || true && npx appium driver install xcuitest@13.5.0)
echo "Setup complete. Run: PYTHONPATH=Scripts $RUNTIME_DIR/venv/bin/python -m unittest discover -s Scripts/tests -t . -v"
