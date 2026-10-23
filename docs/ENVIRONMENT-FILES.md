# Environment files are configuration data

NetClaw's installer writes runtime `.env` settings atomically with mode 0600.
Paths, tokens and other single-line values are quoted as literal dotenv data;
updates preserve unrelated assignments and comments. Symlink targets and
newline/NUL injection are rejected before writing.

Do not `source` an environment file in a shell. Its values can legitimately
contain shell metacharacters. Use your runtime's dotenv loader. The installer
and spec 124 migration scripts parse assignments without executing shell code.
IP Fabric setup now uses that data reader for its connectivity check.

Existing simple assignments and exported/shell-quoted assignments are accepted
by the migration reader. New complex values use dotenv-compatible double quotes,
including escaped quotes/backslashes. A value containing a dotenv variable
reference such as `${NAME}` still follows the consuming runtime's interpolation
policy; avoid variable references in literal credentials or configure that
loader with interpolation disabled.

Use `scripts/write-env.py PATH KEY` with the value on standard input for automation.
It does not echo values and does not accept secret values in command arguments.
The specialized migration scripts also preserve a private backup and support
preview/restore. Keep environment files and backups out of Git.

Environment migrations now also save a private `<backup>.state.json` recovery
journal containing the post-migration digest, not secret values. Restore refuses
to overwrite a file changed by a later migration or manual edit. Undo migrations
in reverse order, or preserve both files and merge later edits manually. A backup
from an older migration without this journal is never treated as permission to
overwrite the current environment; compare it manually. Do not commit journals.

The HUD now uses the same literal encoding for environment updates and writes
its environment, testbed, layout and budget configuration through private atomic files.
To inspect permissions on existing local sensitive files without changing them:

```sh
python3 scripts/migrate-local-file-permissions.py
python3 scripts/migrate-local-file-permissions.py --apply
```

The default set is the runtime `.env`/`openclaw.json`, repository `.env`, and
`testbed/testbed.yaml`; nonexistent files are skipped. Use repeated `--path`
arguments to select a different set. Symlinks, multiple hard links and files
owned by another user are refused. Original modes and content digests are saved
privately in `~/.openclaw/local-permissions-backup.json`. `--restore` previews
recovery; `--restore --apply` restores recorded modes only when file contents
and current modes still match. Restore may make a file readable to other users
again, so use it only for an intentional rollback. No file contents are changed.
