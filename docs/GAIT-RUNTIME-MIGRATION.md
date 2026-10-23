# GAIT runtime migration and recovery

Preview with `bash scripts/gait-venv-setup.sh --preview`, then run without
`--preview` to build an isolated runtime. `uv` must be
installed. `GAIT_VENV` selects its stable location (default
`~/.openclaw/gait-venv`); `NETCLAW_PY` selects the base Python interpreter.

The script creates a separate generation, installs bounded MCP/FastMCP
dependencies, verifies imports, and only then switches the stable path to it.
The previous runtime remains at `<GAIT_VENV>.previous`. Creation, installation,
verification and promotion failures preserve or restore the old runtime. Package
entry points retain their original generation path; virtualenvs are not relocated.

Use `bash scripts/gait-venv-setup.sh --restore` to select the saved runtime again.
The replaced generation is retained. Repeated setup verifies and retains an
already-managed runtime; use `--rebuild` for replacement. A rebuild refuses to overwrite an
existing `.previous` recovery point; archive it deliberately after acceptance.
This script never deletes an operator-selected runtime or installs global packages.

`scripts/gait-stdio.py` uses the dedicated runtime when needed. MCP servers that
import GAIT in-process must declare `gait-ai` in their own runtime; the setup
script no longer silently changes system Python to satisfy them. Existing GAIT
repository/history is outside the virtualenv and remains untouched.
