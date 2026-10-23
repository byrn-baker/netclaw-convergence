"""Real terminal keyboard regressions; no package or service installation."""
import errno
import os
from pathlib import Path
import pty
import re
import select
import subprocess
import tempfile
import termios
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
BASH = os.environ.get('NETCLAW_TEST_BASH', '/bin/bash')


class Terminal:
    def __init__(self, command, env=None):
        self.master, self.slave = pty.openpty()
        self.output = b''
        self.process = subprocess.Popen(
            command, cwd=ROOT, env=env, stdin=self.slave,
            stdout=self.slave, stderr=self.slave,
        )

    def pump(self):
        if select.select([self.master], [], [], 0.02)[0]:
            try:
                self.output += os.read(self.master, 65536)
            except OSError as exc:
                if exc.errno != errno.EIO:
                    raise

    def send_after(self, marker, keys):
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            self.pump()
            # Bash read changes terminal modes after drawing the prompt. Sending
            # before that transition can lose input when read configures the TTY.
            if marker.encode() in self.output and not (
                termios.tcgetattr(self.slave)[3] & termios.ICANON
            ):
                os.write(self.master, keys)
                return
            if self.process.poll() is not None:
                break
        raise AssertionError('Prompt/read not ready: ' + self.output.decode(errors='replace'))

    def finish(self):
        deadline = time.monotonic() + 5
        while self.process.poll() is None and time.monotonic() < deadline:
            self.pump()
        if self.process.poll() is None:
            raise AssertionError('Terminal hung: ' + self.output.decode(errors='replace'))
        self.pump()
        return self.process.returncode, re.sub(r'\[[0-9;?]*[A-Za-z]', '', self.output.decode(errors='replace'))

    def close(self):
        if self.process.poll() is None:
            self.process.kill()
        self.process.wait()
        os.close(self.master)
        os.close(self.slave)


class InstallerKeyboardTests(unittest.TestCase):
    def terminal(self, script):
        terminal = Terminal([BASH, '-c', 'set -euo pipefail; source scripts/lib/tui.sh; ' + script])
        self.addCleanup(terminal.close)
        return terminal

    def test_arrow_encodings_select_hermes(self):
        for down in (b'\x1b[B', b'\x1bOB', b'j'):
            with self.subTest(down=down):
                terminal = self.terminal(
                    'tui_menu Runtime OpenClaw Hermes; printf "RESULT:%s\\n" "$TUI_CHOICE"'
                )
                terminal.send_after('❯ OpenClaw', down)
                terminal.send_after('❯ Hermes', b'\r')
                rc, output = terminal.finish()
                self.assertEqual(rc, 0, output)
                self.assertIn('RESULT:1', output)
                self.assertNotIn('invalid timeout', output)

    def test_up_wraps_to_hermes(self):
        for up in (b'\x1b[A', b'\x1bOA', b'k'):
            with self.subTest(up=up):
                terminal = self.terminal(
                    'tui_menu Runtime OpenClaw Hermes; printf "RESULT:%s\\n" "$TUI_CHOICE"'
                )
                terminal.send_after('❯ OpenClaw', up)
                terminal.send_after('❯ Hermes', b'\r')
                self.assertIn('RESULT:1', terminal.finish()[1])

    def test_arrow_key_decoding(self):
        for prefix in (b'\x1b[', b'\x1bO'):
            for tail, expected in ((b'A', 'up'), (b'B', 'down'),
                                   (b'C', 'right'), (b'D', 'left')):
                with self.subTest(prefix=prefix, tail=tail):
                    terminal = self.terminal(
                        'echo READY; key=$(tui_read_key); echo "KEY:$key"'
                    )
                    terminal.send_after('READY', prefix + tail)
                    rc, output = terminal.finish()
                    self.assertEqual(rc, 0, output)
                    self.assertIn('KEY:' + expected, output)

    def test_checklist_navigation_and_toggle(self):
        terminal = self.terminal(
            'CL_IDS=("" openclaw hermes); CL_LABELS=(Agents OpenClaw Hermes); '
            'CL_ON=(0 0 0); tui_checklist Components; '
            'printf "RESULT:%s\\n" "$TUI_SELECTED"'
        )
        terminal.send_after('❯', b'\x1b[B')
        terminal.send_after('❯\x1b[0m [ ] \x1b[1mHermes', b' ')
        terminal.send_after('1/2 selected', b'\r')
        rc, output = terminal.finish()
        self.assertEqual(rc, 0, output)
        self.assertIn('RESULT:hermes', output)

    def test_failed_read_is_not_enter(self):
        result = subprocess.run(
            [BASH, '-c', 'set -euo pipefail; source scripts/lib/tui.sh; '
             'if tui_read_key; then exit 42; fi'],
            cwd=ROOT, stdin=subprocess.DEVNULL, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, '')

    def test_failed_read_aborts_menu_and_checklist(self):
        for widget in (
            'tui_menu Runtime OpenClaw Hermes',
            'CL_IDS=(hermes); CL_LABELS=(Hermes); CL_ON=(1); tui_checklist Components',
        ):
            result = subprocess.run(
                [BASH, '-c', 'set -euo pipefail; source scripts/lib/tui.sh; '
                 'tui_is_tty() { return 0; }; if ' + widget + '; then exit 42; fi'],
                cwd=ROOT, stdin=subprocess.DEVNULL, capture_output=True, text=True,
                timeout=5,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_noninteractive_menu_keeps_default(self):
        result = subprocess.run(
            [BASH, '-c', 'set -euo pipefail; source scripts/lib/tui.sh; '
             'tui_menu Runtime OpenClaw Hermes; echo "RESULT:$TUI_CHOICE"'],
            cwd=ROOT, stdin=subprocess.DEVNULL, capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('RESULT:0', result.stdout)

    def installer(self, tmp, arguments=()):
        env = {key: value for key, value in os.environ.items()
               if key not in ('NETCLAW_RUNTIME', 'NETCLAW_RUNTIME_EXPLICIT')}
        env.update(OPENCLAW_HOME=str(Path(tmp) / 'openclaw'),
                   HERMES_HOME=str(Path(tmp) / 'hermes'), TERM='xterm-256color')
        terminal = Terminal([BASH, 'scripts/install.sh', *arguments], env)
        self.addCleanup(terminal.close)
        return terminal

    def test_runtime_cancel_stops_installer(self):
        for cancel in (b'q', b'\x1b'):
            with self.subTest(cancel=cancel), tempfile.TemporaryDirectory() as tmp:
                terminal = self.installer(tmp)
                terminal.send_after('Which agent runtime', cancel)
                rc, output = terminal.finish()
                self.assertEqual(rc, 1, output)
                self.assertIn('Install cancelled.', output)
                self.assertNotIn('How do you want to set up', output)
                self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_selected_hermes_reaches_profile_menu(self):
        with tempfile.TemporaryDirectory() as tmp:
            terminal = self.installer(tmp)
            terminal.send_after('Which agent runtime', b'\x1b[B')
            terminal.send_after('❯ Hermes', b'\r')
            terminal.send_after('How do you want to set up', b'q')
            rc, output = terminal.finish()
            self.assertEqual(rc, 1, output)
            self.assertIn('Detected: Hermes', output)
            self.assertIn('Install cancelled.', output)
            self.assertEqual(list(Path(tmp).iterdir()), [])

    def test_explicit_runtime_skips_runtime_menu(self):
        with tempfile.TemporaryDirectory() as tmp:
            terminal = self.installer(tmp, ('--runtime', 'hermes'))
            terminal.send_after('How do you want to set up', b'q')
            rc, output = terminal.finish()
            self.assertEqual(rc, 1, output)
            self.assertNotIn('Which agent runtime', output)
            self.assertIn('Detected: Hermes', output)


if __name__ == '__main__':
    unittest.main()
