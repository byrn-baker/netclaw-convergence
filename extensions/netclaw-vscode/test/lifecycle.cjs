const vscode = require("vscode"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
exports.run = async () => {
  const stage = process.env.NETCLAW_LIFECYCLE_STAGE,
    extension = vscode.extensions.getExtension("NetClaw.netclaw");
  if (stage === "disabled") {
    assert.ok(!extension || !extension.isActive);
    await assert.rejects(
      vscode.commands.executeCommand("netclaw.openOverview"),
    );
    fs.writeFileSync(
      process.env.NETCLAW_TEST_REPORT,
      JSON.stringify({ stage, disabled: true }),
    );
    return;
  }
  assert.ok(extension);
  const api = await extension.activate();
  assert.equal(
    api.connection.ready,
    false,
    "installation/upgrade does not auto-connect",
  );
  let profile = api.profiles
    .list()
    .find((p) => p.label === "Lifecycle preservation");
  if (stage === "initial") {
    assert.ok(!profile);
    profile = await api.profiles.save({
      label: "Lifecycle preservation",
      url: process.env.NETCLAW_TEST_URL,
      installationId: process.env.NETCLAW_TEST_ID,
      harness: "openclaw",
    });
  } else assert.ok(profile, "profile survives replacement/disable");
  await api.connection.connect(profile);
  assert.equal(
    api.connection.identity.installationId,
    process.env.NETCLAW_TEST_ID,
  );
  assert.deepEqual(
    api.assistants.provideMcpServerDefinitions(),
    [],
    "assistants require opt-in",
  );
  api.connection.disconnect();
  fs.writeFileSync(
    process.env.NETCLAW_TEST_REPORT,
    JSON.stringify({
      stage,
      version: extension.packageJSON.version,
      profileId: profile.id,
      extensionPath: extension.extensionPath,
      connected: true,
    }),
  );
};
