This project provides a workspace-local virtual environment helper to make it easy for contributors to create and use the correct Python environment.

Quick start (Windows - PowerShell):

1. Open the repo in VS Code.
2. Open the Command Palette (Ctrl+Shift+P) and choose "Tasks: Run Task" → "Setup .venv (Windows)". Or run in PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
powershell -ExecutionPolicy Bypass -File .\setup_venv.ps1
```

3. After the script completes, the workspace `.venv` will be created and populated. New VS Code terminals will auto-activate it.

Quick start (macOS / Linux):

```bash
./setup_venv.sh
```

Notes:
- The repository includes `.vscode/settings.json` which points to `${workspaceFolder}/.venv/Scripts/python.exe` on Windows and enables terminal environment activation. Contributors should create the workspace `.venv` using the above scripts so VS Code will use it automatically.
- Push these files to your remote (GitHub) so other contributors receive them when cloning the repo.
