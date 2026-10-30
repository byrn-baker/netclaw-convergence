#!/bin/bash
# Explicit native prerequisite review precedes this fixed host-package step.
set -euo pipefail
umask 077
[[ "$#" -eq 1 && "$(/usr/bin/uname -s)" == Darwin ]] || exit 2
case "$1" in
  git) formula=git ;;
  python3) formula=python@3.12 ;;
  node) formula=node@24 ;;
  uv) formula=uv ;;
  *) exit 2 ;;
esac
case "$(/usr/bin/uname -m)" in
  arm64) prefix=/opt/homebrew ;;
  x86_64) prefix=/usr/local ;;
  *) exit 2 ;;
esac
export HOMEBREW_NO_ANALYTICS=1 HOMEBREW_NO_AUTO_UPDATE=1
export PATH="$prefix/bin:$prefix/sbin:/usr/bin:/bin:/usr/sbin:/sbin"
if [[ ! -x "$prefix/bin/brew" ]]; then
  installer=$(/usr/bin/mktemp -t netclaw-homebrew)
  trap '/bin/rm -f "$installer"' EXIT
  /usr/bin/curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    'https://raw.githubusercontent.com/Homebrew/install/be041513824fd2666a0e93cf5c3b0ca3bb0eb4b6/install.sh' -o "$installer"
  digest=$(/usr/bin/shasum -a 256 "$installer")
  [[ "${digest%% *}" == 5f333bbe53bc490e51e7ccb1df8779b3dd6ee73a1a7379efda216edb08ccb148 ]] || { echo 'Homebrew installer integrity check failed.'; exit 7; }
  /bin/bash "$installer"
fi
"$prefix/bin/brew" install --formula "$formula"
echo 'Package step finished. Close this terminal and recheck prerequisites in NetClaw.'
