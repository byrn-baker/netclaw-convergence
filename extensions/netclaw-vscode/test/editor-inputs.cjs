const vscode = require("vscode"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { typeAndCheck } = require("./keyboard.cjs");

exports.run = async () => {
  const root = process.env.NETCLAW_TEST_FIXTURE_ROOT;
  assert.ok(root, "Input acceptance requires an isolated fixture");
  const extension = vscode.extensions.getExtension("NetClaw.netclaw");
  require("./verify-installed.cjs")(extension);
  const api = await extension.activate();
  const profile = await api.profiles.save({
    label: "Input hotfix isolated fixture",
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
  page.setDefaultTimeout(15000);
  const checks = [],
    reportDir = path.dirname(process.env.NETCLAW_TEST_REPORT);
  const frameFor = async (kind) => {
    for (let i = 0; i < 250; i++) {
      for (const f of page.frames())
        if (
          await f
            .locator(`body[data-kind="${kind}"]`)
            .count()
            .catch(() => 0)
        )
          return f;
      await new Promise((r) => setTimeout(r, 80));
    }
    throw Error("Missing webview " + kind);
  };
  const mark = (s) => {
    checks.push(s);
    console.log("INPUT check: " + s);
  };
  const file = path.join(root, "testbed/testbed.yaml");
  const defaults = {
    class: "unicon.Unicon",
    arguments: { init_exec_commands: [], init_config_commands: [] },
  };
  const devices = {
    "defaults-first": {
      alias: "Lab router",
      os: "iosxe",
      type: "router",
      platform: "cat8000v",
      connections: {
        defaults,
        ssh: {
          protocol: "ssh",
          ip: "192.0.2.101",
          port: 22,
          ssh_options: "-o StrictHostKeyChecking=no",
        },
        console: { protocol: "telnet", host: "console.example", port: 2300 },
      },
      credentials: {
        default: { username: "fixture", password: "synthetic-only" },
      },
    },
    "host-only": {
      os: "linux",
      connections: {
        defaults,
        cli: { protocol: "ssh", host: "lab.example", port: 2222 },
      },
    },
    "env-reference": {
      os: "iosxe",
      connections: {
        defaults,
        ssh: { protocol: "ssh", ip: "%ENV{LAB_ROUTER_IP}", port: 22 },
      },
    },
    ipv6: {
      os: "iosxe",
      connections: {
        defaults,
        ssh: { protocol: "ssh", ip: "2001:db8::10", port: 22 },
      },
    },
  };
  fs.writeFileSync(file, JSON.stringify({ devices }));
  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await vscode.commands.executeCommand("notifications.clearAll");
  const panel = await vscode.commands.executeCommand("netclaw.openNetwork");
  try {
    const frame = await frameFor("testbed");
    await frame
      .locator("#status")
      .filter({ hasText: /Testbed loaded/ })
      .waitFor();
    await frame
      .getByRole("button", { name: "Edit device", exact: true })
      .first()
      .click();
    await frame.waitForFunction(
      () => document.activeElement.id === "device-alias",
    );
    // Run typing first so the old release reports focus separately from bad IP selection.
    for (const [id, value] of Object.entries({
      alias: "Updated router",
      os: "iosxe",
      type: "router",
      platform: "cat8000v",
      host: "192.0.2.111",
      protocol: "ssh",
      port: "2222",
    }))
      await typeAndCheck(page, frame, "#device-" + id, value);
    mark(
      "Existing-device fields retain focus and every character with real page keyboard events",
    );
    await typeAndCheck(page, frame, "#device-alias", "Keyboard");
    for (let i = 0; i < 8; i++) await page.keyboard.down("x");
    await page.keyboard.up("x");
    assert.equal(
      await frame.locator("#device-alias").inputValue(),
      "Keyboardxxxxxxxx",
    );
    await page.keyboard.press("Home");
    await page.keyboard.press("Delete");
    assert.equal(
      await frame.locator("#device-alias").inputValue(),
      "eyboardxxxxxxxx",
    );
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
    assert.equal(
      await frame.locator("#device-alias").inputValue(),
      "eyboardxxxxxxx",
    );
    const clipboard = await vscode.env.clipboard.readText();
    try {
      await vscode.env.clipboard.writeText("Pasted router é");
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+A" : "Control+A",
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+V" : "Control+V",
      );
      await frame.waitForFunction(
        () =>
          document.getElementById("device-alias").value === "Pasted router é",
      );
    } finally {
      await vscode.env.clipboard.writeText(clipboard);
    }
    await page.keyboard.press("Tab");
    assert.equal(
      await frame.evaluate(() => document.activeElement.id),
      "device-os",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await frame.evaluate(() => document.activeElement.id),
      "device-alias",
    );
    mark(
      "Held keys, Delete, Backspace, clipboard replacement and Tab/Shift+Tab retain focus",
    );

    const other = await vscode.workspace.openTextDocument({
      content: "Isolated focus acceptance",
    });
    await vscode.window.showTextDocument(other);
    panel.reveal();
    await frame.locator("#device-alias").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" after tab", { delay: 80 });
    assert.equal(
      await frame.locator("#device-alias").inputValue(),
      "Pasted router é after tab",
    );
    assert.equal(
      await frame.evaluate(() => document.activeElement.id),
      "device-alias",
    );
    mark("Draft and uninterrupted typing survive switching editor tabs");
    // Delay delivery of a real isolated-HUD preview response to the host. The
    // packaged webview/host handlers and the HUD still execute unchanged.
    const client = api.connection.client,
      request = client.request;
    let release;
    const delayed = new Promise((resolve) => {
      release = resolve;
    });
    client.request = async function (method, route, ...args) {
      const result = await request.call(this, method, route, ...args);
      if (method === "POST" && route === "/api/testbed/preview") await delayed;
      return result;
    };
    try {
      await frame
        .getByRole("button", { name: "Preview device change", exact: true })
        .click();
      await frame.waitForFunction(
        () => document.getElementById("device-alias").disabled,
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      assert.equal(await frame.locator("#device-alias").isDisabled(), true);
      release();
      await frame.waitForFunction(() => document.activeElement.id === "save");
      await typeAndCheck(page, frame, "#device-alias", "After slow preview");
      assert.equal(await frame.locator("#review").isVisible(), false);
      mark(
        "Slow preview keeps controls busy, then typing recovers and invalidates its review",
      );
    } finally {
      release();
      client.request = request;
    }
    // Reopen the original snapshot without applying the typed draft.
    await frame.locator("#refresh").click();
    await page
      .getByRole("button", { name: "Discard draft", exact: true })
      .click();
    await frame.waitForFunction(
      () => !document.getElementById("refresh").disabled,
    );
    await frame
      .getByRole("button", { name: "Edit device", exact: true })
      .first()
      .click();
    await frame.waitForFunction(
      () => document.activeElement.id === "device-alias",
    );
    const observed = await frame.evaluate(() => ({
      connection: document.getElementById("connection-choice").value,
      address: document.getElementById("device-host").value,
      placeholder: document.getElementById("device-host").placeholder,
      choices: [...document.getElementById("connection-choice").options].map(
        (e) => e.value,
      ),
    }));
    fs.writeFileSync(
      path.join(reportDir, "initial-endpoint.json"),
      JSON.stringify(observed, null, 2),
    );
    assert.equal(observed.connection, "ssh", JSON.stringify(observed));
    assert.equal(observed.address, "192.0.2.101");
    assert.ok(!observed.choices.includes("defaults"));
    mark("pyATS defaults are excluded and Edit shows the stored SSH IP");
    await page.screenshot({
      path: path.join(reportDir, "existing-device.png"),
    });
    await typeAndCheck(page, frame, "#device-host", "192.0.2.111");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("1");
    assert.equal(
      await frame.locator("#device-host").inputValue(),
      "192.0.2.111",
    );
    assert.equal(
      await frame.evaluate(() => document.activeElement.id),
      "device-host",
    );
    await typeAndCheck(page, frame, "#device-alias", "Edited router");
    await frame
      .getByRole("button", { name: "Preview device change", exact: true })
      .click();
    await frame.waitForFunction(() => document.activeElement.id === "save");
    await typeAndCheck(page, frame, "#device-alias", "Edited router");
    assert.equal(
      await frame.locator("#review").isVisible(),
      false,
      "editing must cancel the old review without stealing focus",
    );
    await page.keyboard.insertText(" – lab");
    assert.equal(
      await frame.locator("#device-alias").inputValue(),
      "Edited router – lab",
    );
    assert.equal(
      await frame.evaluate(() => document.activeElement.id),
      "device-alias",
    );
    await frame
      .getByRole("button", { name: "Preview device change", exact: true })
      .click();
    await frame.waitForFunction(() => document.activeElement.id === "save");
    await frame.locator("#save").click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await frame
      .locator("#status")
      .filter({ hasText: /saved and verified/ })
      .waitFor();
    const YAML = require("../node_modules/yaml");
    const saved = YAML.parse(fs.readFileSync(file, "utf8"));
    assert.equal(
      saved.devices["defaults-first"].connections.ssh.ip,
      "192.0.2.111",
    );
    assert.equal(saved.devices["defaults-first"].alias, "Edited router – lab");
    assert.deepEqual(
      saved.devices["defaults-first"].connections.defaults,
      defaults,
    );
    assert.deepEqual(
      saved.devices["defaults-first"].credentials,
      devices["defaults-first"].credentials,
    );
    assert.deepEqual(
      saved.devices["defaults-first"].connections.console,
      devices["defaults-first"].connections.console,
    );
    assert.equal(
      saved.devices["defaults-first"].connections.ssh.ssh_options,
      devices["defaults-first"].connections.ssh.ssh_options,
    );
    mark(
      "Reviewed save reads back the edited IP and preserves defaults, credentials, console and SSH options",
    );
    for (const [id, address] of [
      ["defaults-first", "192.0.2.111"],
      ["host-only", "lab.example"],
      ["env-reference", "%ENV{LAB_ROUTER_IP}"],
      ["ipv6", "2001:db8::10"],
    ]) {
      await typeAndCheck(page, frame, "#filter", id, 30);
      await frame
        .getByRole("button", { name: "Edit device", exact: true })
        .click();
      await frame.waitForFunction(
        () => document.activeElement.id === "device-alias",
      );
      assert.equal(
        await frame.locator("#device-host").inputValue(),
        address,
        id,
      );
      await frame.locator("#cancel-form").click();
      await frame.waitForFunction(() => document.activeElement.id === "add");
    }
    mark(
      "Reopened literal IPv4, IPv6, hostname and ENV reference values match their stored endpoints",
    );
    await frame.locator("#add").click();
    await frame.waitForFunction(
      () => document.activeElement.id === "device-id",
    );
    for (const [id, value] of Object.entries({
      id: "keyboard-device",
      alias: "Keyboard device",
      os: "linux",
      type: "server",
      platform: "generic",
      connection: "ssh",
      protocol: "ssh",
      host: "keyboard.example",
      port: "2200",
    }))
      await typeAndCheck(page, frame, "#device-" + id, value, 40);
    await page.keyboard.press("Tab");
    assert.equal(
      await frame.evaluate(() => document.activeElement.type),
      "submit",
    );
    await page.keyboard.press("Enter");
    await frame.waitForFunction(() => document.activeElement.id === "save");
    await frame.locator("#save").click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await frame
      .locator("#status")
      .filter({ hasText: /saved and verified/ })
      .waitFor();
    assert.equal(
      YAML.parse(fs.readFileSync(file, "utf8")).devices["keyboard-device"]
        .connections.ssh.ip,
      "keyboard.example",
    );
    mark(
      "Every Add field supports continuous typing, Tab, Enter, reviewed save and file readback",
    );
    await frame.locator("#yaml-mode").click();
    await frame.waitForFunction(() => document.activeElement.id === "yaml");
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+End" : "Control+End",
    );
    const before = await frame.locator("#yaml").inputValue();
    await page.keyboard.type("\n# keyboard draft", { delay: 100 });
    assert.equal(await frame.evaluate(() => document.activeElement.id), "yaml");
    assert.equal(
      await frame.locator("#yaml").inputValue(),
      before + "\n# keyboard draft",
    );
    mark("Advanced YAML retains focus during continuous keyboard input");
    api.connection.disconnect();
    await frame.waitForFunction(() => document.getElementById("yaml").disabled);
    assert.equal(await frame.locator("#yaml").inputValue(), "");
    await api.connection.connect(profile);
    panel.dispose();
    const reopened = await vscode.commands.executeCommand(
      "netclaw.openNetwork",
    );
    try {
      const fresh = await frameFor("testbed");
      await fresh
        .locator("#status")
        .filter({ hasText: /Testbed loaded/ })
        .waitFor();
      await fresh.locator("#add").click();
      await fresh.waitForFunction(
        () => document.activeElement.id === "device-id",
      );
      await typeAndCheck(page, fresh, "#device-id", "after-reconnect");
      mark(
        "Disconnect clears and disables drafts; a fresh view accepts typing after reconnect",
      );
    } finally {
      reopened.dispose();
    }
  } finally {
    panel.dispose();
  }
  fs.writeFileSync(
    process.env.NETCLAW_TEST_REPORT,
    JSON.stringify(
      {
        version: extension.packageJSON.version,
        editor: vscode.version,
        extensionHost: process.platform,
        remoteName: vscode.env.remoteName,
        checks,
      },
      null,
      2,
    ),
  );
  await browser.close();
};
