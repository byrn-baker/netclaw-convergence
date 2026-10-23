#!/usr/bin/env python3
"""Prepare a spec-linked NetClaw 1.x.y release; dry-run unless --apply is set."""
from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
VERSION_RE = re.compile(r"1\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")


def version_at(root: Path) -> str:
    version = (root / "VERSION").read_text().strip()
    if not VERSION_RE.fullmatch(version):
        raise ValueError("VERSION must contain one stable 1.x.y version")
    return version


def check(root: Path) -> str:
    version = version_at(root)
    notes = root / "docs/releases" / f"{version}.md"
    content = notes.read_text()
    if not content.startswith(f"# NetClaw {version}"):
        raise ValueError("Release notes must start with the matching NetClaw version heading")
    if "RELEASE_TODO" in content:
        raise ValueError("Complete all RELEASE_TODO fields before publishing")
    changelog = (root / "CHANGELOG.md").read_text()
    headings = re.findall(r"^## \[([^\]]+)\] - (\d{4}-\d{2}-\d{2})$", changelog, re.M)
    if not headings or headings[0][0] != version:
        raise ValueError("The newest CHANGELOG release must match VERSION")
    date.fromisoformat(headings[0][1])
    return version


def prepare(root: Path, bump: str, spec: str, apply: bool = False) -> str:
    current = check(root)
    if not re.fullmatch(r"[0-9]{3,}", spec):
        raise ValueError("Spec must be a numbered prefix, e.g. 130")
    matches = [p for p in (root / "specs").glob(f"{spec}-*") if p.is_dir()]
    if len(matches) != 1:
        raise ValueError("Spec number must resolve to exactly one directory")
    spec_dir = matches[0]
    for name in ("spec.md", "research.md", "plan.md", "tasks.md"):
        if not (spec_dir / name).is_file():
            raise ValueError(f"Missing {spec_dir.name}/{name}")
    _, minor, patch = map(int, current.split("."))
    if bump == "minor":
        next_version = f"1.{minor + 1}.0"
    elif bump == "patch":
        next_version = f"1.{minor}.{patch + 1}"
    else:
        raise ValueError("Bump must be minor or patch")
    notes = root / "docs/releases" / f"{next_version}.md"
    if notes.exists():
        raise ValueError(f"Refusing to overwrite {notes.relative_to(root)}")
    changelog_path = root / "CHANGELOG.md"
    changelog = changelog_path.read_text()
    if re.search(rf"^## \[{re.escape(next_version)}\]", changelog, re.M):
        raise ValueError("Changelog already contains the proposed version")
    entry = (f"## [{next_version}] - {date.today().isoformat()}\n\n"
             f"Spec [{spec_dir.name}](specs/{spec_dir.name}/spec.md). "
             f"See [release notes](docs/releases/{next_version}.md).\n\n")
    first_release = re.search(r"^## \[", changelog, re.M)
    assert first_release is not None  # check() established a release heading
    updated = changelog[:first_release.start()] + entry + changelog[first_release.start():]
    note_text = (f"# NetClaw {next_version}\n\n"
                 f"Spec: [{spec_dir.name}](../../specs/{spec_dir.name}/spec.md)\n\n"
                 "## Changes\n\nRELEASE_TODO: Describe shipped behavior and user benefit.\n\n"
                 "## Upgrade and compatibility\n\nRELEASE_TODO: Document migration, or explain why none is required.\n\n"
                 "## Validation and known limitations\n\nRELEASE_TODO: Link actual verification and name untested boundaries.\n")
    if apply:
        notes.write_text(note_text)
        changelog_path.write_text(updated)
        (root / "VERSION").write_text(next_version + "\n")
    return next_version


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--bump", choices=("minor", "patch"))
    mode.add_argument("--check", action="store_true", help="Validate current version, notes and changelog")
    parser.add_argument("--spec", help="Number of the completed spec, e.g. 130")
    parser.add_argument("--apply", action="store_true", help="Write prepared files (default: preview only)")
    args = parser.parse_args()
    if args.check and (args.spec or args.apply):
        parser.error("--check cannot be combined with --spec or --apply")
    if args.bump and not args.spec:
        parser.error("--bump requires --spec")
    try:
        if args.check:
            print(f"Release metadata: PASS ({check(ROOT)})")
        else:
            old = version_at(ROOT)
            new = prepare(ROOT, args.bump, args.spec, args.apply)
            print(f"{'Prepared' if args.apply else 'Preview'}: {old} -> {new} (spec {args.spec})")
            print(f"Files: VERSION, CHANGELOG.md, docs/releases/{new}.md")
            print("Complete the notes, verify, review and merge before tagging; nothing was published.")
        return 0
    except (OSError, ValueError) as exc:
        print(f"Release preparation failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
