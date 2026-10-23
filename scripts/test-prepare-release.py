#!/usr/bin/env python3
"""Offline tests for release preparation, isolated from the real checkout."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("prepare_release", Path(__file__).with_name("prepare-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "VERSION").write_text("1.7.9\n")
        (self.root / "CHANGELOG.md").write_text("# Changelog\n\n## [1.7.9] - 2026-09-28\n\nExisting release.\n")
        (self.root / "docs/releases").mkdir(parents=True)
        (self.root / "docs/releases/1.7.9.md").write_text("# NetClaw 1.7.9\n\nReleased.\n")
        self.feature = self.root / "specs/130-example"
        self.feature.mkdir(parents=True)
        for name in ("spec.md", "research.md", "plan.md", "tasks.md"):
            (self.feature / name).write_text("Reviewed artifact.\n")

    def snapshot(self):
        return {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}

    def test_preview_never_writes_and_minor_resets_patch(self):
        before = self.snapshot()
        self.assertEqual(release.prepare(self.root, "minor", "130"), "1.8.0")
        self.assertEqual(self.snapshot(), before)

    def test_patch_applies_coherent_files_and_requires_finished_notes(self):
        self.assertEqual(release.prepare(self.root, "patch", "130", True), "1.7.10")
        self.assertEqual((self.root / "VERSION").read_text(), "1.7.10\n")
        self.assertIn("specs/130-example/spec.md", (self.root / "CHANGELOG.md").read_text())
        with self.assertRaisesRegex(ValueError, "RELEASE_TODO"):
            release.check(self.root)
        notes = self.root / "docs/releases/1.7.10.md"
        notes.write_text(notes.read_text().replace("RELEASE_TODO", "Verified"))
        self.assertEqual(release.check(self.root), "1.7.10")

    def test_refuses_overwrite_without_partial_changes(self):
        (self.root / "docs/releases/1.8.0.md").write_text("Existing draft")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "overwrite"):
            release.prepare(self.root, "minor", "130", True)
        self.assertEqual(before, self.snapshot())

    def test_rejects_missing_ambiguous_or_invalid_spec_without_writes(self):
        for value in ("999", "../130", "13"):
            before = self.snapshot()
            with self.assertRaises(ValueError):
                release.prepare(self.root, "minor", value, True)
            self.assertEqual(before, self.snapshot())
        (self.root / "specs/130-collision").mkdir()
        with self.assertRaisesRegex(ValueError, "exactly one"):
            release.prepare(self.root, "minor", "130", True)

    def test_rejects_missing_artifacts(self):
        (self.feature / "research.md").unlink()
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "research.md"):
            release.prepare(self.root, "patch", "130", True)
        self.assertEqual(before, self.snapshot())

    def test_rejects_version_or_changelog_mismatch(self):
        for value in ("2.0.0", "1.01.0", "1.0.0-rc1"):
            (self.root / "VERSION").write_text(value)
            with self.assertRaises(ValueError):
                release.check(self.root)
        (self.root / "VERSION").write_text("1.7.8")
        (self.root / "docs/releases/1.7.8.md").write_text("# NetClaw 1.7.8\n")
        with self.assertRaisesRegex(ValueError, "CHANGELOG"):
            release.check(self.root)


if __name__ == "__main__":
    unittest.main()
