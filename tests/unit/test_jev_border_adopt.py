"""Scoped upgrade preserves custom Border state and refuses stale rollback."""
import importlib.util
import json
from pathlib import Path
import stat

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('jev_border_adopt', ROOT/'scripts/jev-border-adopt.py')
adopt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(adopt)


def existing(tmp_path):
    workspace = tmp_path/'risk-border/workspace'
    workspace.mkdir(parents=True)
    (workspace/'SOUL.md').write_text('# Custom Border\nRisk: operator-risk\nMembers: cml, pyats\nPersonal rules stay.\n')
    (workspace/'IDENTITY.md').write_text('Custom identity untouched')
    (workspace/'skills/custom').mkdir(parents=True)
    (workspace/'skills/custom/SKILL.md').write_text('curated custom skill')
    return workspace


def test_preview_apply_repeat_and_restore_preserve_existing_risk(tmp_path, capsys):
    workspace = existing(tmp_path)
    original = (workspace/'SOUL.md').read_bytes()
    assert adopt.main(['--workspace', str(workspace)]) == 0
    assert (workspace/'SOUL.md').read_bytes() == original
    assert not (workspace/'.jev-adoption-backups').exists()
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 0
    after = (workspace/'SOUL.md').read_text()
    assert after.startswith(original.decode())
    assert after.count(adopt.START) == 1
    assert 'before final operational summaries' in after
    assert (workspace/'IDENTITY.md').read_text() == 'Custom identity untouched'
    assert (workspace/'skills/custom/SKILL.md').read_text() == 'curated custom skill'
    backups = list((workspace/'.jev-adoption-backups').glob('*.json'))
    assert len(backups) == 1
    assert stat.S_IMODE(backups[0].stat().st_mode) == 0o600
    assert stat.S_IMODE(backups[0].parent.stat().st_mode) == 0o700
    assert (workspace.parent/'docs/JEV-SCIENCE-OFFICER.md').is_file()
    assert (workspace/'docs/JEV-SCIENCE-OFFICER.md').read_bytes() == (ROOT/'docs/JEV-SCIENCE-OFFICER.md').read_bytes()
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 0
    assert len(list(backups[0].parent.glob('*.json'))) == 1
    assert adopt.main(['--workspace', str(workspace), '--restore', str(backups[0])]) == 0
    assert (workspace/'SOUL.md').read_bytes() == original
    assert not (workspace/'skills/jev-answer-review/SKILL.md').exists()
    assert (workspace/'skills/custom/SKILL.md').read_text() == 'curated custom skill'


def test_restore_conflict_is_preflighted_before_any_file_changes(tmp_path):
    workspace = existing(tmp_path)
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 0
    backup = next((workspace/'.jev-adoption-backups').glob('*.json'))
    changed = workspace/'skills/jev-answer-review/SKILL.md'
    changed.write_text('operator edited after adoption')
    soul = (workspace/'SOUL.md').read_bytes()
    assert adopt.main(['--workspace', str(workspace), '--restore', str(backup)]) == 1
    assert (workspace/'SOUL.md').read_bytes() == soul
    assert changed.read_text() == 'operator edited after adoption'


def test_malformed_markers_or_linked_targets_refuse_without_updates(tmp_path):
    workspace = existing(tmp_path)
    (workspace/'SOUL.md').write_text(adopt.START+'\nmalformed')
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 1
    assert not (workspace/'.jev-adoption-backups').exists()
    (workspace/'SOUL.md').write_text('Custom Border\n')
    linked = workspace/'skills/jev-evidence-review'
    elsewhere = tmp_path/'elsewhere'
    elsewhere.mkdir()
    (elsewhere/'SKILL.md').write_text('custom linked source')
    linked.symlink_to(elsewhere, target_is_directory=True)
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 1
    assert (elsewhere/'SKILL.md').read_text() == 'custom linked source'
    assert not (workspace/'.jev-adoption-backups').exists()


def test_restore_rejects_record_with_outside_path(tmp_path):
    workspace = existing(tmp_path)
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 0
    backup = next((workspace/'.jev-adoption-backups').glob('*.json'))
    data = json.loads(backup.read_text())
    data['files'][0]['path'] = '../../outside'
    backup.write_text(json.dumps(data))
    assert adopt.main(['--workspace', str(workspace), '--restore', str(backup)]) == 1


def test_later_adoption_updates_only_managed_section(tmp_path, monkeypatch):
    workspace = existing(tmp_path)
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 0
    soul = workspace/'SOUL.md'
    soul.write_text(soul.read_text()+'\nOperator addition after Jev section.\n')
    monkeypatch.setattr(adopt.border, 'JEV_ADVISOR_SECTION', adopt.border.JEV_ADVISOR_SECTION+'\nNew advisory instruction.\n')
    assert adopt.main(['--workspace', str(workspace), '--apply']) == 0
    text = soul.read_text()
    assert text.count(adopt.START) == 1
    assert text.count('New advisory instruction.') == 1
    assert text.endswith('Operator addition after Jev section.\n')
    assert text.startswith('# Custom Border\nRisk: operator-risk\nMembers: cml, pyats\n')
