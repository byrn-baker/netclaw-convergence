# Automated pyATS / Genie runtime setup

Run the installer **where Python will execute**, not on a network router or in
the CML controller. It prepares a dedicated virtualenv; it does not modify the
user's global Python libraries, enable virtualization, change the testbed, or
send commands to devices. It installs pyATS/Genie release 26.8 by default from
PyPI. Transitive dependencies are resolved by pip, not fully hash-locked.

## Linux, working WSL, or macOS

From the repository root, using an existing Python 3.10+ interpreter:

```sh
python3 scripts/install-pyats-genie.py --yes
```

The default directory is `~/.netclaw/pyats-venv`. To choose a location:

```sh
python3 scripts/install-pyats-genie.py --venv /path/to/netclaw-pyats --yes
```

The installer prints progress, runs `pip check`, imports Genie, and parses a
synthetic `show ip interface brief` response with network methods disabled.
Only after verification does it print **READY** and `PYATS_PYTHON="..."`.
No environment activation is needed when the API uses that absolute path.

Existing unmanaged directories are never modified. To validate an existing
user-provided virtualenv without installing anything:

```sh
python3 scripts/install-pyats-genie.py --venv /path/to/existing/venv --check-only
```

Rerunning on an already working managed environment is a no-op. Release changes
require explicit `--upgrade --version <exact-release>`. A failed install leaves
the partial managed environment for retry; it never deletes user directories.
Missing venv/ensurepip support needs an administrator-provided matching Python
venv package (on Ubuntu, commonly `python3-venv`). The installer does not run sudo.

## Windows launcher (existing WSL only)

From the repository root in PowerShell:

```powershell
.\Install-NetClaw-pyATS.ps1 -Distribution Ubuntu -Yes
```

Options: `-Python /path/to/python3`, `-EnvironmentPath /home/user/netclaw-pyats`,
`-Version 26.8`, `-Upgrade`, `-CheckOnly`, and non-executing `-WhatIf`.
Without `-Yes`, the launcher asks before installing packages.

Native Windows Python is not supported by upstream pyATS/Genie. The launcher
checks WSL before making any installation changes. If Ubuntu cannot start or
reports `HCS_E_SERVICE_NOT_AVAILABLE`, installing pip libraries cannot fix that.
It stops without changing Hyper-V, BIOS, Windows features, services, or VMware.
Do not blindly enable the Windows hypervisor on a VMware/CML lab host.

## Connect the verified runtime to the API

Use the printed `PYATS_PYTHON` value in the API's existing `.env` configuration.
For a Windows API using WSL, also use the printed `PYATS_WSL_DISTRO` value.
Persistent process environment variables override `.env` values; restart the
API if those process settings change. The installer does not edit these files.

The current API can launch local Python or WSL Python. A Linux VM's path is not
reachable merely by setting `PYATS_PYTHON` on a Windows host. A remote parser
transport/runtime-selection GUI is a separate integration and is **not included**
in this installer. Alternatively run the API on the same Linux host as Python.

Sources: [pyATS package/platform requirements](https://pypi.org/project/pyats/),
[Genie package](https://pypi.org/project/genie/26.8/),
[Cisco CML virtualization guidance](https://developer.cisco.com/docs/modeling-labs/faq/).

Validation: `python scripts/test-install-pyats-genie.py` tests installer flow with
mock package/Genie calls (no downloads), not a live Linux installation. The real
offline parser verification runs during installation on the user's target host.
