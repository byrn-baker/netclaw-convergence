const vscode = require("vscode"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
exports.run = async () => {
  const extension = vscode.extensions.getExtension("NetClaw.netclaw");
  assert.ok(extension);
  if (process.env.NETCLAW_TEST_INSTALLED_ROOT) {
    assert.ok(
      extension.extensionPath.startsWith(
        process.env.NETCLAW_TEST_INSTALLED_ROOT + path.sep,
      ),
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
  }
  const liveProvider = process.env.NETCLAW_TEST_LIVE_PROVIDER === "1";
  const expectedReply = liveProvider
    ? /Thursday[\s\S]*14:20\s*UTC/i
    : "Synthetic gateway reply";
  const api = await extension.activate();
  assert.ok(extension.isActive);
  const profile = await api.profiles.save({
    label: "Isolated source NetClaw",
    url: process.env.NETCLAW_TEST_URL,
    installationId: process.env.NETCLAW_TEST_ID,
    harness: "openclaw",
  });
  await api.connection.connect(profile);
  assert.equal(api.connection.identity.installationId, profile.installationId);
  const runtime = await api.connection.request("GET", "/api/runtime");
  assert.equal(runtime.kind, "openclaw");
  await assert.rejects(
    api.connection.connect({
      ...profile,
      installationId: "33333333-3333-4333-8333-333333333333",
    }),
  );
  await api.connection.connect(profile);
  const checks = [
    "actual extension activation",
    "saved host-local profile",
    "source HUD identity binding",
    "mismatched identity rejected",
  ];

  const mark = (...values) => {
    checks.push(...values);
    console.log("SPEC150 check: " + values.join("; "));
  };
  const registration = api.assistants.file("copilot");
  fs.mkdirSync(api.assistants.directory, { recursive: true, mode: 0o700 });
  const reg = {
    id: profile.id + "-copilot",
    client: "copilot",
    url: profile.url,
    installationId: profile.installationId,
    enabled: true,
    delegate: false,
  };
  fs.writeFileSync(registration, JSON.stringify(reg), { mode: 0o600 });
  const definitions = api.assistants.provideMcpServerDefinitions();
  assert.equal(definitions.length, 1);
  const definition = api.assistants.resolveMcpServerDefinition(definitions[0]);
  assert.ok(definition);
  assert.equal(definition.env.ELECTRON_RUN_AS_NODE, "1");
  const sdkRequire = require("node:module").createRequire(
    path.resolve(__dirname, "../../../ui/netclaw-visual/package.json"),
  );
  const { Client } = sdkRequire("@modelcontextprotocol/client"),
    { StdioClientTransport } = sdkRequire("@modelcontextprotocol/client/stdio");
  const mcp = new Client({ name: "editor-definition-check", version: "1.0.0" });
  try {
    const transport = new StdioClientTransport({
      command: definition.command,
      args: definition.args,
      env: { ...process.env, ...definition.env },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (b) =>
      console.log("MCP test diagnostics: " + b.toString().slice(0, 1000)),
    );
    await mcp.connect(transport, { timeout: 10000 });
    const result = await mcp.callTool({
      name: "netclaw_status",
      arguments: {},
    });
    assert.equal(
      result.structuredContent.installationId,
      profile.installationId,
    );
    fs.writeFileSync(registration, JSON.stringify({ ...reg, enabled: false }));
    assert.equal(
      (await mcp.callTool({ name: "netclaw_status", arguments: {} })).isError,
      true,
    );
  } finally {
    await mcp.close();
  }
  assert.deepEqual(api.assistants.provideMcpServerDefinitions(), []);
  mark(
    "actual VS Code MCP definition launches bundled adapter with Electron; cached disable enforced (not Copilot inference)",
  );
  const screenshots = [];
  if (process.env.NETCLAW_TEST_PLAYWRIGHT) {
    const { chromium } = require(process.env.NETCLAW_TEST_PLAYWRIGHT);
    const browser = await chromium.connectOverCDP(
      "http://127.0.0.1:" + process.env.NETCLAW_TEST_CDP_PORT,
    );
    try {
      const page = browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().includes("workbench"));
      assert.ok(page);
      page.setDefaultTimeout(30000);
      const frameFor = async (selector) => {
        const until = Date.now() + 20000;
        while (Date.now() < until) {
          for (const f of page.frames())
            if (
              await f
                .locator(selector)
                .count()
                .catch(() => 0)
            )
              return f;
          await new Promise((r) => setTimeout(r, 100));
        }
        throw Error("Webview missing " + selector);
      };
      const shot = async (name) => {
        const file = path.join(
          path.dirname(process.env.NETCLAW_TEST_REPORT),
          name + ".png",
        );
        await page.screenshot({ path: file });
        screenshots.push(file);
      };
      const overviewPanel = await vscode.commands.executeCommand(
        "netclaw.openOverview",
      );
      const overview = await frameFor(".data-view");
      await overview
        .locator("#content")
        .getByText(profile.installationId, { exact: true })
        .first()
        .waitFor();
      for (const theme of [
        "Default Dark Modern",
        "Default Light Modern",
        "Default High Contrast",
      ]) {
        await vscode.workspace
          .getConfiguration("workbench")
          .update("colorTheme", theme, vscode.ConfigurationTarget.Global);
        await overview.locator("#refresh").click();
        await shot(theme.replaceAll(" ", "-"));
      }
      mark("actual overview rendering in dark/light/high contrast");
      await vscode.workspace
        .getConfiguration("workbench")
        .update(
          "colorTheme",
          "Default Dark Modern",
          vscode.ConfigurationTarget.Global,
        );
      if (liveProvider) {
        const document = await vscode.workspace.openTextDocument({
          content:
            "Fictional training note: the maintenance window is Thursday at 14:20 UTC. This note describes no real device or approved change.",
          language: "plaintext",
        });
        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(
          document.positionAt(0),
          document.positionAt(document.getText().length),
        );
        await vscode.commands.executeCommand("editor.action.selectAll");
        assert.equal(
          vscode.window.activeTextEditor?.document.uri.toString(),
          document.uri.toString(),
        );
        assert.equal(
          vscode.window.activeTextEditor.document.getText(
            vscode.window.activeTextEditor.selection,
          ),
          document.getText(),
        );
        const staging = vscode.commands.executeCommand(
          "netclaw.addSelectedContext",
        );
        try {
          await page
            .getByRole("button", { name: "Stage selected text", exact: true })
            .click();
        } catch (error) {
          await shot("context-review-failure");
          fs.writeFileSync(
            path.join(
              path.dirname(process.env.NETCLAW_TEST_REPORT),
              "context-review-failure.txt",
            ),
            await page.locator("body").innerText(),
          );
          throw error;
        }
        await staging;
        assert.equal(api.connection.contexts.size, 1);
        mark(
          "native selected-editor-text review stages only harmless context locally",
        );
      }
      await vscode.commands.executeCommand("netclaw.openChat");
      const chat = await frameFor("#composer");
      if (liveProvider)
        await chat.locator('#contexts input[type="checkbox"]').check();
      await chat
        .locator("#prompt")
        .fill(
          liveProvider
            ? "What day and time does the fictional training note schedule its maintenance window? Summarize those two details in an ordinary sentence. This is a reading exercise only; do not use tools or perform any action."
            : "Synthetic fixture greeting",
        );
      await chat.locator("#send").click();
      await chat
        .locator("#transcript article")
        .filter({
          has: chat.getByRole("heading", { name: "NetClaw", exact: true }),
        })
        .getByText(expectedReply, { exact: !liveProvider })
        .waitFor({ timeout: liveProvider ? 180000 : 20000 });
      await shot("chat");
      mark(
        liveProvider
          ? "actual composer -> source HUD -> existing configured provider -> rendered reply"
          : "actual composer -> source HUD -> synthetic gateway -> rendered reply",
      );
      overviewPanel.reveal();
      const revealedOverview = await frameFor(".data-view");
      await revealedOverview
        .locator("#status")
        .filter({ hasText: "Observed result" })
        .waitFor();
      await revealedOverview.locator("#refresh").click();
      await revealedOverview
        .locator("#content")
        .getByText(profile.installationId, { exact: true })
        .first()
        .waitFor();
      await vscode.commands.executeCommand("netclaw.openChat");
      const revealedChat = await frameFor("#composer");
      await revealedChat
        .locator("#status")
        .filter({ hasText: "Ready for an explicit request." })
        .waitFor();
      await revealedChat.locator("#refresh").click();
      await revealedChat
        .locator("#transcript article")
        .filter({
          has: revealedChat.getByRole("heading", {
            name: "NetClaw",
            exact: true,
          }),
        })
        .getByText(expectedReply, { exact: !liveProvider })
        .waitFor();
      mark(
        "hidden Overview and Chat restore and accept refresh without resending work",
      );
      const canvasPanel =
        await vscode.commands.executeCommand("netclaw.openCanvas");
      const canvas = await frameFor(".canvas-lane");
      await canvas
        .getByRole("button", { name: "Branch this conversation" })
        .first()
        .click();
      await canvas.locator(".canvas-lane").nth(1).waitFor();
      await canvas.locator("#save").click();
      await canvas
        .locator("#status")
        .filter({ hasText: /Investigation saved/ })
        .waitFor();
      await shot("canvas");
      mark("Canvas branch without dispatch");
      if (!liveProvider) {
        const lane = canvas.locator(".canvas-lane").first();
        await lane.locator("textarea").fill("Synthetic Canvas hotfix request");
        await lane
          .getByRole("button", { name: "Send in this lane", exact: true })
          .click();
        await lane
          .locator("pre")
          .filter({ hasText: "assistant: Synthetic gateway reply" })
          .waitFor();
        await lane
          .getByRole("button", { name: "Send in this lane", exact: true })
          .waitFor();
        assert.equal(
          await lane
            .getByRole("button", { name: "Send in this lane", exact: true })
            .isEnabled(),
          true,
        );
        mark(
          "Canvas Send receives fixture reply and re-enables for another explicit request",
        );
      }
      const ragPanel = await vscode.commands.executeCommand("netclaw.openRag");
      const rag = await frameFor("#rag-search");
      if (process.env.NETCLAW_TEST_RAG_READY === "1") {
        await rag
          .locator("#status")
          .filter({ hasText: "Collections refreshed." })
          .waitFor({ timeout: 90000 });
        await rag.locator("#query").fill("When is the maintenance window?");
        await rag.getByRole("button", { name: "Search knowledge" }).click();
        await rag.locator("#results pre").first().waitFor({ timeout: 90000 });
        assert.match(
          await rag.locator("#results").textContent(),
          /violet Thursday/,
        );
        mark("actual integrated RAG search and rendered citation");
      }
      await shot("rag");
      assert.match(await rag.locator("h1").textContent(), /RAG/);
      mark("integrated RAG panel; backend may be unavailable in fixture");
      canvasPanel.reveal();
      const restoredCanvas = await frameFor(".canvas-lane");
      await restoredCanvas.locator(".canvas-lane").nth(1).waitFor();
      await restoredCanvas.locator("#save").click();
      await restoredCanvas
        .locator("#status")
        .filter({ hasText: /Investigation saved/ })
        .waitFor();
      await restoredCanvas.locator("#open").click();
      await restoredCanvas
        .locator("#status")
        .filter({ hasText: /Save investigation/ })
        .waitFor();
      await restoredCanvas.locator(".canvas-lane").nth(1).waitFor();
      mark("hidden Canvas restores both lanes and accepts save/open");
      ragPanel.reveal();
      const restoredRag = await frameFor("#rag-search");
      if (process.env.NETCLAW_TEST_RAG_READY === "1") {
        await restoredRag
          .locator("#status")
          .filter({ hasText: "Collections refreshed." })
          .waitFor({ timeout: 90000 });
        await restoredRag.locator("#refresh").click();
        await restoredRag
          .locator("#query")
          .fill("When is the maintenance window?");
        await restoredRag
          .getByRole("button", { name: "Search knowledge" })
          .click();
        await restoredRag
          .locator("#results pre")
          .first()
          .waitFor({ timeout: 90000 });
        assert.match(
          await restoredRag.locator("#results").textContent(),
          /violet Thursday/,
        );
        mark(
          "hidden RAG restores inventory and accepts refresh/search with cited retrieval",
        );
      }
      const closingEditors = vscode.commands.executeCommand(
        "workbench.action.closeAllEditors",
      );
      if (liveProvider)
        await page
          .getByRole("button", { name: "Don't Save", exact: true })
          .click();
      await closingEditors;
      await vscode.commands.executeCommand("netclaw.openAvatar");
      const avatar = await frameFor("#avatar-character");
      await avatar.locator("#avatar-character").selectOption("lobster");
      await shot("avatar");
      mark("bundled local Avatar");
      api.connection.disconnect();
      await avatar
        .locator("#status")
        .filter({ hasText: /Connection changed/ })
        .waitFor();
      assert.equal(await avatar.locator("#send").isDisabled(), true);
      mark("target switch invalidates webview");
    } finally {
      await browser.close();
    }
  }
  await api.profiles.remove(profile.id);
  api.connection.disconnect();
  fs.writeFileSync(
    process.env.NETCLAW_TEST_REPORT,
    JSON.stringify(
      {
        editor: vscode.version,
        packageMode: process.env.NETCLAW_TEST_VSIX
          ? "exact installed VSIX; all payload bytes verified"
          : "development extension",
        checks,
        screenshots,
        scope: liveProvider
          ? "Actual desktop extension against source HUD and existing configured OpenClaw provider; only harmless acceptance text, no device/WSL claim."
          : "Actual desktop extension against source HUD with synthetic local gateway; no real provider/device/WSL claim.",
      },
      null,
      2,
    ),
  );
};
