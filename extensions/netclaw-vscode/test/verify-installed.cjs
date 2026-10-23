const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
module.exports = (extension) => {
  const root = process.env.NETCLAW_TEST_INSTALLED_ROOT;
  if (!root) return;
  assert.ok(
    extension.extensionPath.startsWith(root + path.sep),
    "Load the installed candidate, not the source extension",
  );
  require("node:child_process").execFileSync("python3", [
    "-c",
    `
import zipfile,json,pathlib,sys
with zipfile.ZipFile(sys.argv[1]) as archive:
 for name in archive.namelist():
  if not name.startswith('extension/') or name.endswith('/'): continue
  actual=(pathlib.Path(sys.argv[2])/name.removeprefix('extension/')).read_bytes()
  expected=archive.read(name)
  if name=='extension/package.json':
   value=json.loads(actual);value.pop('__metadata',None)
   assert value==json.loads(expected), name
  else: assert actual==expected, name
`,
    process.env.NETCLAW_TEST_VSIX,
    extension.extensionPath,
  ]);
};
