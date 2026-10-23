const vscode = require("vscode"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
exports.run = async () => {
  const extension = vscode.extensions.getExtension("NetClaw.netclaw");
  require("./verify-installed.cjs")(extension);
  const api = await extension.activate();
  const profile = await api.profiles.save({
    label: "Live compatibility qualification",
    url: process.env.NETCLAW_TEST_URL,
    installationId: process.env.NETCLAW_TEST_ID,
    harness: "openclaw",
  });
  await api.connection.connect(profile);
  const { chromium } = require(process.env.NETCLAW_TEST_PLAYWRIGHT);
  const browser = await chromium.connectOverCDP(
    "http://127.0.0.1:" + process.env.NETCLAW_TEST_CDP_PORT,
  );
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().includes("workbench"));
  page.setDefaultTimeout(20000);
  const checks = [],
    shots = [],
    reportDir = path.dirname(process.env.NETCLAW_TEST_REPORT);
  const frameFor = async (kind) => {
    for (let i = 0; i < 200; i++) {
      for (const frame of page.frames())
        if (
          await frame
            .locator(`body[data-kind="${kind}"]`)
            .count()
            .catch(() => 0)
        )
          return frame;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Missing " + kind);
  };
  const shot = async (name) => {
    const file = path.join(reportDir, name + ".png");
    await page.screenshot({ path: file });
    shots.push(file);
  };
  try {
    await vscode.commands.executeCommand("workbench.action.closeSidebar");
    await vscode.commands.executeCommand("netclaw.openNetwork");
    const tb = await frameFor("testbed");
    await tb.locator("#devices article").first().waitFor();
    assert.equal(
      await tb.locator("#devices article").count(),
      (await api.connection.request("GET", "/api/terminal/devices")).devices
        .length,
    );
    assert.equal(await tb.locator("#add").isEnabled(), false);
    await shot("live-testbed-compatibility");
    checks.push(
      "Installed candidate displays actual older-HUD device details and disables unsupported writes",
    );
    await vscode.commands.executeCommand("netclaw.configureMcp", "netbox");
    const mcp = await frameFor("mcp");
    await mcp.locator("#environment").waitFor({ state: "visible" });
    assert.equal(await mcp.locator("#save-fields").isEnabled(), false);
    await mcp.locator("#environment").click();
    await page.getByText("Setting to replace", { exact: true }).waitFor();
    await page.locator(".quick-input-widget input").press("Escape");
    await shot("live-mcp-compatibility");
    checks.push(
      "Installed candidate opens the existing native environment review; cancellation performs no write",
    );
    if (process.env.NETCLAW_TEST_SECURITY_TARGETS) {
      const targets = JSON.parse(
        fs.readFileSync(process.env.NETCLAW_TEST_SECURITY_TARGETS, "utf8"),
      );
      for (const product of ["defenseclaw", "openshell"]) {
        const target = targets[product];
        await vscode.commands.executeCommand(
          product === "defenseclaw"
            ? "netclaw.openSecurity"
            : "netclaw.openOpenShell",
        );
        const frame = await frameFor(
          product === "defenseclaw" ? "security" : "openshell",
        );
        await frame
          .locator("#status")
          .filter({ hasText: /Observed result/ })
          .waitFor();
        await frame.locator("#bind").click();
        for (const [title, value] of [
          ["Existing runtime home", target.runtimeHome],
          [product + " executable on this host", target.executable],
          [
            product === "defenseclaw"
              ? "DefenseClaw data directory"
              : "OpenShell configuration root",
            target.securityHome,
          ],
          ...(product === "openshell"
            ? [
                ["OpenShell gateway", target.gateway],
                ["OpenShell workspace", "default"],
                ["OpenShell sandbox", target.sandbox],
              ]
            : []),
        ]) {
          await page.getByText(title, { exact: true }).waitFor();
          const input = page.locator(".quick-input-widget input");
          await input.fill(value);
          await input.press("Enter");
        }
        await page
          .getByRole("button", { name: "Bind security target", exact: true })
          .click();
        await frame
          .locator("#status")
          .filter({ hasText: /Security policy loaded/ })
          .waitFor();
        await frame
          .locator("#permissions-section")
          .waitFor({ state: "visible" });
        await frame.getByText("Show redacted YAML", { exact: true }).click();
        await frame.locator("#policy-yaml").waitFor({ state: "visible" });
        assert.ok(
          (await frame.locator("#policy-yaml").textContent()).length > 50,
        );
        await frame
          .locator("#policy-document-section")
          .scrollIntoViewIfNeeded();
        await shot("live-" + product + "-policy");
        checks.push(
          product +
            ": actual installed native profile bound; permissions and redacted YAML visible; no security mutations",
        );
      }
    }
  } finally {
    api.connection.disconnect();
    await browser.close();
  }
  fs.writeFileSync(
    process.env.NETCLAW_TEST_REPORT,
    JSON.stringify(
      {
        editor: vscode.version,
        platform: process.platform,
        remote: vscode.env.remoteName || null,
        packageMode: "exact installed VSIX",
        checks,
        screenshots: shots,
        scope:
          "Read-only UI inspection of actual existing HUD and optional native security targets; native environment review cancelled without changes.",
      },
      null,
      2,
    ),
  );
};
