// mcp-call.py accepts a POSIX shlex string, then executes argv without a shell.
export function mcpCommand(argv) {
  return argv.map((arg) => "'" + String(arg).replaceAll("'", "'\\''") + "'").join(' ');
}
