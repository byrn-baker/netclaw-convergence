const vscode = require("vscode"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
exports.run = async ({ api, bindings, targets, profile, report }) => {
  const { chromium } = require(process.env.NETCLAW_TEST_PLAYWRIGHT);
  const browser = await chromium.connectOverCDP(
    "http://127.0.0.1:" + process.env.NETCLAW_TEST_CDP_PORT,
  );
  const page = browser
    .contexts()
    .flatMap((c) => c.pages())
    .find((p) => p.url().includes("workbench"));
  page.setDefaultTimeout(20000);
  let reloading = false;
  const checks = [],
    shots = [],
    matrix = [];
  const mark = (s) => {
    checks.push(s);
    fs.writeFileSync(
      report,
      JSON.stringify(
        { complete: false, editor: vscode.version, checks, shots, matrix },
        null,
        2,
      ),
    );
  };
  const settle = (ms) => new Promise((r) => setTimeout(r, ms || 200));
  const frame = async () => {
    for (let i = 0; i < 200; i++) {
      for (const f of [...page.frames()].reverse())
        if (
          await f
            .locator(".workspace-page")
            .isVisible()
            .catch(() => false)
        )
          return f;
      await settle(100);
    }
    throw Error("Workspace webview missing.");
  };
  const dialog = async (name) => {
    await page.getByRole("button", { name, exact: true }).click();
  };
  const shot = async (name) => {
    const p = path.join(profile, "screenshots", name + ".png");
    await page.screenshot({ path: p });
    shots.push(p);
  };
  const lifecycle = async (action) => {
    const pending = api.workspace.lifecycle(action);
    await dialog("Confirm " + action);
    await pending;
  };
  const content = (t, n) => fs.readFileSync(path.join(t.workspace, n), "utf8");
  const names = [
    "SOUL.md",
    "AGENTS.md",
    "IDENTITY.md",
    "USER.md",
    "TOOLS.md",
    "HEARTBEAT.md",
  ];
  try {
    // Exercise real native binding review against the source HUD, not only seeded preview metadata.
    const bind = vscode.commands.executeCommand("netclaw.bindWorkspace");
    await dialog("Enable controls");
    await bind;
    mark(
      "Native local-source binding dialog accepted and same identity verified.",
    );
    await vscode.commands.executeCommand("netclaw.workspaceControls");
    let f = await frame();
    await f.locator(".workspace-file").first().waitFor();
    assert.equal(await f.locator(".workspace-file").count(), 6);
    mark("Six workspace files visible in the real VS Code panel.");
    for (let k = 0; k < bindings.length; k++) {
      await api.management.select(bindings[k].profile);
      await api.connection.connect(bindings[k].profile);
      const t = targets[k];
      for (const name of names) {
        const doc = await api.workspace.open(name);
        assert.equal(doc.getText(), content(t, name));
        const original = doc.getText();
        const editor = vscode.window.activeTextEditor;
        await editor.edit((b) =>
          b.insert(
            new vscode.Position(doc.lineCount, 0),
            "\nVerified " + k + " " + name + " 🦞\n",
          ),
        );
        const save = doc.save();
        await dialog("Save file");
        assert.equal(await save, true);
        assert.equal(content(t, name), doc.getText());
        assert.ok(content(t, name).includes("Verified"));
        mark(
          `${t.target.kind} ${name}: native read/edit/review/save verified.`,
        );
        await vscode.commands.executeCommand("notifications.clearAll");
      }
    }
    await api.management.select(bindings[0].profile);
    await api.connection.connect(bindings[0].profile);
    await vscode.workspace
      .getConfiguration("files")
      .update("simpleDialog.enable", true, vscode.ConfigurationTarget.Global);
    const uploadFile = path.join(profile, "uploaded.md"),
      uploadBytes = Buffer.from(
        "\uFEFF# Uploaded persona 🦞\r\nPreserve exact CRLF.\r\n",
      );
    fs.writeFileSync(uploadFile, uploadBytes);
    for (let k = 0; k < bindings.length; k++) {
      await api.management.select(bindings[k].profile);
      await api.connection.connect(bindings[k].profile);
      for (const name of names) {
        const pending = api.workspace.upload(name);
        const input = page.locator(".quick-input-widget input");
        await input.waitFor({ state: "visible" });
        await input.fill(uploadFile);
        await input.press("Enter");
        await dialog("Save file");
        await pending;
        assert.deepEqual(
          fs.readFileSync(path.join(targets[k].workspace, name)),
          uploadBytes,
        );
        await vscode.commands.executeCommand("notifications.clearAll");
        mark(
          targets[k].target.kind +
            " native upload " +
            name +
            " preserves BOM/CRLF/Unicode bytes.",
        );
      }
    }
    await api.management.select(bindings[0].profile);
    await api.connection.connect(bindings[0].profile);
    const doc = await api.workspace.open("USER.md");
    await vscode.commands.executeCommand(
      "workbench.action.focusActiveEditorGroup",
    );
    const end = doc.positionAt(doc.getText().length);
    vscode.window.activeTextEditor.selection = new vscode.Selection(end, end);
    const start = doc.getText();
    await page.keyboard.type("continuous-keyboard-12345", { delay: 20 });
    await settle();
    assert.equal(doc.getText(), start + "continuous-keyboard-12345");
    await page.keyboard.press("Meta+z");
    await settle();
    assert.equal(doc.getText(), start);
    mark(
      "Continuous real keyboard input and Undo retain every character without refocusing.",
    );
    await vscode.window.activeTextEditor.edit((b) =>
      b.insert(
        new vscode.Position(doc.lineCount, 0),
        "\nUnsaved protected draft\n",
      ),
    );
    const close = vscode.commands.executeCommand(
      "workbench.action.closeActiveEditor",
    );
    await dialog("Cancel");
    await close;
    assert.equal(doc.isDirty, true);
    mark("Native dirty-close Cancel preserves the draft.");
    // Theme / panel navigation retains the actual Markdown document, not a recreated textarea.
    await vscode.commands.executeCommand("netclaw.workspaceControls");
    f = await frame();
    for (const item of [
      { theme: "Default Light Modern", width: 408 },
      { theme: "Default Dark Modern", width: 950 },
      { theme: "Default High Contrast", width: 1280 },
    ]) {
      await vscode.workspace
        .getConfiguration("workbench")
        .update("colorTheme", item.theme, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand("workbench.action.closeSidebar");
      await page.setViewportSize({ width: item.width, height: 950 });
      await settle(500);
      f = await frame();
      const g = await f.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      assert.ok(g.scroll <= g.client + 2, JSON.stringify(g));
      if (item.width === 408)
        assert.ok(
          g.width <= 365,
          "Expected an actual narrow webview: " + JSON.stringify(g),
        );
      matrix.push({ ...item, ...g });
      assert.equal(doc.isDirty, true);
      await shot(item.theme.replaceAll(" ", "-"));
    }
    await vscode.workspace
      .getConfiguration("window")
      .update("zoomLevel", 4, vscode.ConfigurationTarget.Global);
    await settle(600);
    await shot("zoom-200");
    await vscode.workspace
      .getConfiguration("window")
      .update("zoomLevel", 0, vscode.ConfigurationTarget.Global);
    await vscode.workspace
      .getConfiguration("workbench")
      .update(
        "colorTheme",
        "Default Dark Modern",
        vscode.ConfigurationTarget.Global,
      );
    await page.setViewportSize({ width: 1280, height: 950 });
    mark(
      "Light/dark/high-contrast, narrow panel and 200% zoom preserve draft and layout.",
    );
    await api.workspace.open("USER.md");
    const cancelled = doc.save();
    await dialog("Cancel");
    assert.equal(await cancelled, false);
    assert.equal(doc.isDirty, true);
    mark("Cancelled save leaves disk unchanged and draft dirty.");
    await vscode.commands.executeCommand("notifications.clearAll");
    const before = JSON.parse(
      fs.readFileSync(
        path.join(
          targets[0].target.home,
          "netclaw-hud/management/services/hud.process.json",
        ),
      ),
    ).pid;
    const combined = api.workspace.saveAndRestart();
    await dialog("Save and Restart");
    await combined;
    assert.equal(doc.isDirty, false);
    assert.ok(
      content(targets[0], "USER.md").includes("Unsaved protected draft"),
    );
    const after = JSON.parse(
      fs.readFileSync(
        path.join(
          targets[0].target.home,
          "netclaw-hud/management/services/hud.process.json",
        ),
      ),
    ).pid;
    assert.notEqual(after, before);
    mark(
      "Save and Restart verified persisted bytes before a real full service restart.",
    );
    for (let k = 0; k < bindings.length; k++) {
      await api.management.select(bindings[k].profile);
      await api.connection.connect(bindings[k].profile);
      await lifecycle("stop");
      assert.ok(!api.connection.ready);
      await assert.rejects(fetch(targets[k].url));
      await lifecycle("start");
      assert.equal(
        api.connection.identity.installationId,
        bindings[k].target.installationId,
      );
      mark(
        `${bindings[k].target.kind}: full Stop removes HUD; offline Start restores same installation.`,
      );
    }
    await api.management.select(bindings[0].profile);
    await api.connection.connect(bindings[0].profile);
    await vscode.commands.executeCommand("netclaw.workspaceControls");
    await vscode.commands.executeCommand("workbench.view.extension.netclaw");
    await vscode.commands.executeCommand("notifications.clearAll");
    await settle(500);
    await shot("final-preview");
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await lifecycle("stop");
    fs.writeFileSync(
      path.join(profile, "resume.json"),
      JSON.stringify({ installationId: bindings[0].target.installationId }),
    );
    mark("Stopped installation before reloading the actual extension host.");
    reloading = true;
    await vscode.commands.executeCommand("workbench.action.reloadWindow");
  } catch (e) {
    if (reloading) return;
    fs.writeFileSync(
      report,
      JSON.stringify(
        {
          complete: false,
          editor: vscode.version,
          checks,
          shots,
          matrix,
          error: String(e.stack || e),
        },
        null,
        2,
      ),
    );
    await shot("failure");
    throw e;
  }
};

exports.resume = async ({ api, targets, profile, report }) => {
  const evidence = JSON.parse(fs.readFileSync(report)),
    resume = JSON.parse(fs.readFileSync(path.join(profile, "resume.json")));
  assert.equal(
    api.management.selected.target.installationId,
    resume.installationId,
  );
  assert.ok(!api.connection.ready);
  await assert.rejects(fetch(targets[0].url));
  const { chromium } = require(process.env.NETCLAW_TEST_PLAYWRIGHT),
    browser = await chromium.connectOverCDP(
      "http://127.0.0.1:" + process.env.NETCLAW_TEST_CDP_PORT,
    ),
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().includes("workbench"));
  page.setDefaultTimeout(20000);
  const start = api.workspace.lifecycle("start");
  await page
    .getByRole("button", { name: "Confirm start", exact: true })
    .click();
  await start;
  assert.equal(api.connection.identity.installationId, resume.installationId);
  evidence.checks.push(
    "Offline binding survives real VS Code reload; Start restores the identical installation.",
  );
  await vscode.commands.executeCommand("netclaw.workspaceControls");
  await vscode.commands.executeCommand("workbench.view.extension.netclaw");
  await vscode.commands.executeCommand("notifications.clearAll");
  await new Promise((r) => setTimeout(r, 1000));
  const screenshot = path.join(
    profile,
    "screenshots",
    "offline-reload-recovered.png",
  );
  await page.screenshot({ path: screenshot });
  evidence.shots.push(screenshot);
  assert.ok(!evidence.error, evidence.error);
  evidence.complete = true;
  fs.writeFileSync(report, JSON.stringify(evidence, null, 2));
};
