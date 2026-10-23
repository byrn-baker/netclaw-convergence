#!/usr/bin/env python3
"""Launch MemPalace's module with the interpreter selected by the installer."""
import os
from pathlib import Path
import sys


def interpreter():
    configured = os.environ.get('MEMPALACE_MCP_PYTHON')
    if configured:
        return configured
    # Compatibility for skills invoking this wrapper with system Python.
    record = Path.home() / '.openclaw/python-runtimes/records/mempalace'
    return record.read_text().strip() if record.is_file() else sys.executable


if __name__ == '__main__':
    python = interpreter()
    os.execv(python, [python, '-m', 'mempalace.mcp_server', *sys.argv[1:]])
