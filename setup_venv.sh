#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(dirname "${BASH_SOURCE[0]}")"
cd "$ROOT_DIR"

if [ ! -d .venv ]; then
  echo "Creating virtualenv at ./.venv"
  python3 -m venv .venv
fi

source .venv/bin/activate
python -m pip install --upgrade pip
if [ -f backend/requirements.txt ]; then
  pip install -r backend/requirements.txt
fi
if [ -f requirements.txt ]; then
  pip install -r requirements.txt
fi

echo "Done. Run: python backend/main.py"