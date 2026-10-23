const { typeAndCheck } = require("./keyboard.cjs");
const vscode = require("vscode"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
exports.run = async () => {
  if (!process.env.NETCLAW_TEST_FIXTURE_ROOT)
    throw Error("Spec151 acceptance requires an isolated fixture.");
  const extension = vscode.extensions.getExtension("NetClaw.netclaw"),
    api = await extension.activate(),
    root = process.env.NETCLAW_TEST_FIXTURE_ROOT,
    reportDir = path.dirname(process.env.NETCLAW_TEST_REPORT),
    checks = [],
    shots = [],
    matrix = [];
  const { chromium } = require(process.env.NETCLAW_TEST_PLAYWRIGHT),
    browser = await chromium.connectOverCDP(
      "http://127.0.0.1:" + process.env.NETCLAW_TEST_CDP_PORT,
    ),
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find((p) => p.url().includes("workbench"));
  require("./verify-installed.cjs")(extension);
  page.setDefaultTimeout(15000);
  const mark = (s) => {
    checks.push(s);
    console.log("SPEC151 check: " + s);
  };
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
      await new Promise((r) => setTimeout(r, 80));
    }
    throw Error("Missing webview " + selector);
  };
  const shot = async (name) => {
    const file = path.join(reportDir, name + ".png");
    await page.screenshot({ path: file });
    shots.push(file);
  };
  const settle = () => new Promise((r) => setTimeout(r, 150));
  const auditLayout = async (frame, view) => {
    const cases = [
      { theme: "Default Light Modern", width: 360 },
      { theme: "Default Dark Modern", width: 700 },
      { theme: "Default High Contrast", width: 1200 },
    ];
    for (const item of cases) {
      await vscode.workspace
        .getConfiguration("workbench")
        .update("colorTheme", item.theme, vscode.ConfigurationTarget.Global);
      await page.setViewportSize({ width: item.width + 48, height: 950 });
      await settle();
      const geometry = await frame.evaluate(() => ({
        viewport: innerWidth,
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      assert.ok(
        geometry.scroll <= geometry.client + 2,
        view + " " + JSON.stringify(geometry),
      );
      matrix.push({ view, ...item, ...geometry });
    }
    await vscode.workspace
      .getConfiguration("window")
      .update(
        "zoomLevel",
        Math.log(2) / Math.log(1.2),
        vscode.ConfigurationTarget.Global,
      );
    await settle();
    assert.equal(
      await frame.locator("h1").isVisible(),
      true,
      view + " zoom heading",
    );
    await vscode.workspace
      .getConfiguration("window")
      .update("zoomLevel", 0, vscode.ConfigurationTarget.Global);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await settle();
    assert.equal(
      await frame.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
      true,
    );
    const control = frame
      .locator(
        "button:visible:not([disabled]),input:visible:not([disabled]),select:visible:not([disabled]),textarea:visible:not([disabled])",
      )
      .first();
    if (await control.count()) {
      await control.focus();
      assert.equal(
        await control.evaluate((e) => document.activeElement === e),
        true,
        view + " keyboard focus",
      );
      await control.press("Tab");
    }
    matrix.push({
      view,
      zoom: "200%",
      keyboard: "focus and Tab",
      motion: "reduced",
    });
    await vscode.workspace
      .getConfiguration("workbench")
      .update(
        "colorTheme",
        "Default Dark Modern",
        vscode.ConfigurationTarget.Global,
      );
    await page.setViewportSize({ width: 1280, height: 950 });
    await settle();
  };
  try {
    // Exercise the real native prompts, including their instructional copy.
    const adding = vscode.commands.executeCommand("netclaw.addConnection");
    await page.getByText("Name this connection", { exact: true }).waitFor();
    assert.match(await page.locator("body").innerText(), /friendly name/);
    const input = page.locator(".quick-input-widget input");
    await input.fill("Spec151 local studio");
    await input.press("Enter");
    await page.getByText("NetClaw HUD API address", { exact: true }).waitFor();
    await input.fill(process.env.NETCLAW_TEST_URL);
    await input.press("Enter");
    await page
      .getByRole("button", { name: "Bind installation", exact: true })
      .click();
    await adding;
    assert.equal(
      api.connection.identity.installationId,
      process.env.NETCLAW_TEST_ID,
    );
    mark("Native nickname/API prompts and installation binding");
    await vscode.commands.executeCommand("workbench.action.closeSidebar");
    await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
    await vscode.commands.executeCommand("notifications.clearAll");
    await require("./editor-hotfix.cjs")({
      vscode,
      page,
      frameFor,
      root,
      mark,
      shot,
    });
    // Every existing observation view, including actual unavailable sources.
    const domains = [
      "overview",
      "estate",
      "peers",
      "mobile",
      "science",
      "topology",
      "operations",
      "gait",
      "integrations",
      "skills",
      "settings",
      "configuration",
      "tokenomics",
      "budget",
      "security",
      "openshell",
      "knowledge",
      "documentation",
      "reference",
      "logs",
      "intent",
    ];
    for (const kind of domains) {
      const panel = await vscode.commands.executeCommand(
          "netclaw.openDomain",
          kind,
        ),
        frame = await frameFor(`body[data-kind="${kind}"]`);
      await frame
        .locator("#status")
        .filter({ hasText: /Observed result|refused|unavailable|failed/i })
        .waitFor({ timeout: 90000 });
      assert.ok(await frame.locator("h1").textContent());
      assert.equal(await frame.locator(".page-purpose").count(), 1);
      assert.equal(
        (await frame.locator("details:not([open])").count()) > 0 ||
          (await frame.locator("#status").textContent()) !== "Observed result",
        true,
      );
      matrix.push({
        view: kind,
        state: await frame.locator("#status").textContent(),
      });
      await auditLayout(frame, kind);
      await shot("domain-" + kind);
      panel.dispose();
    }
    mark(
      "All21 generic domain views: semantic title/purpose/cards or explicit source failure",
    );
    const testbed = await vscode.commands.executeCommand("netclaw.openNetwork"),
      tb = await frameFor('body[data-kind="testbed"]');
    await tb
      .locator("#status")
      .filter({ hasText: /Testbed loaded/ })
      .waitFor();
    await tb.locator("#add").click();
    await tb.locator("#device-form").waitFor({ state: "visible" });
    for (const [key, value] of Object.entries({
      id: "lab-core",
      os: "iosxe",
      alias: "Lab core",
      host: "192.0.2.1",
    }))
      await tb.locator("#device-" + key).fill(value);
    await tb.getByRole("button", { name: "Preview device change" }).click();
    await tb.locator("#review").waitFor({ state: "visible" });
    assert.equal(
      fs.readFileSync(path.join(root, "testbed/testbed.yaml"), "utf8"),
      "devices: {}\n",
    );
    await tb.locator("#save").click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await tb
      .locator("#status")
      .filter({ hasText: /saved and verified/ })
      .waitFor();
    assert.match(
      fs.readFileSync(path.join(root, "testbed/testbed.yaml"), "utf8"),
      /lab-core/,
    );
    await auditLayout(tb, "testbed-cards");
    await shot("testbed-cards");
    mark(
      "Guided create → read-only preview → native review → verified isolated save",
    );
    await tb.locator("#yaml-mode").click();
    await tb.locator("#yaml").waitFor({ state: "visible" });
    await tb
      .locator("#yaml")
      .fill((await tb.locator("#yaml").inputValue()) + "# retained draft\n");
    for (const theme of [
      "Default Light Modern",
      "Default Dark Modern",
      "Default High Contrast",
    ]) {
      await vscode.workspace
        .getConfiguration("workbench")
        .update("colorTheme", theme, vscode.ConfigurationTarget.Global);
      await settle();
      assert.match(await tb.locator("#yaml").inputValue(), /retained draft/);
      await shot("testbed-" + theme.replaceAll(" ", "-"));
    }
    mark("Unsaved YAML draft survives live light/dark/high-contrast changes");
    await tb.locator("#cards-mode").click();
    await page
      .getByRole("button", { name: "Keep draft and switch", exact: true })
      .click();
    await tb.locator("#yaml-mode").click();
    await page
      .getByRole("button", { name: "Keep draft and switch", exact: true })
      .click();
    assert.match(await tb.locator("#yaml").inputValue(), /retained draft/);
    mark("Native mode switch keeps unsaved work");
    await auditLayout(tb, "testbed-yaml");
    const mcpPanel = await vscode.commands.executeCommand(
        "netclaw.configureMcp",
        "netbox",
      ),
      mcp = await frameFor('body[data-kind="mcp"]');
    await mcp.locator("#intent-NETBOX_TOKEN").waitFor();
    await mcp.locator("#intent-NETBOX_TOKEN").selectOption("replace");
    await typeAndCheck(
      page,
      mcp,
      "#value-NETBOX_TOKEN",
      "synthetic-secret-151-editor",
      35,
    );
    await mcp.locator("#intent-NETBOX_URL").selectOption("replace");
    await typeAndCheck(
      page,
      mcp,
      "#value-NETBOX_URL",
      "https://netbox.example",
      35,
    );
    await vscode.workspace
      .getConfiguration("workbench")
      .update(
        "colorTheme",
        "Default Light Modern",
        vscode.ConfigurationTarget.Global,
      );
    assert.equal(
      await mcp.locator("#value-NETBOX_TOKEN").inputValue(),
      "synthetic-secret-151-editor",
    );
    await shot("mcp-fields-light");
    await mcp.getByRole("button", { name: "Review & save fields" }).click();
    await page
      .getByRole("button", { name: "Save fields", exact: true })
      .click();
    await mcp
      .locator("#status")
      .filter({ hasText: /Saved and verified/ })
      .waitFor();
    assert.equal(await mcp.locator("#value-NETBOX_TOKEN").inputValue(), "");
    assert.ok(
      fs
        .readFileSync(path.join(root, "runtime/.env"), "utf8")
        .includes("synthetic-secret-151-editor"),
    );
    mark(
      "Scoped MCP native review, secret replacement, verified save and private reset",
    );
    await mcp.locator("#reload").click();
    await mcp.waitForFunction(
      () => !document.getElementById("reload").disabled,
    );
    await mcp.locator("#setup").click();
    await page.getByText("Read lifecycle guidance", { exact: true }).waitFor();
    await page.locator(".quick-input-widget input").press("Escape");
    await mcp.waitForFunction(() => !document.getElementById("setup").disabled);
    mark("MCP Reload and setup menu cancellation return to enabled fields");
    await auditLayout(mcp, "mcp-fields");
    // Width, zoom and keyboard controls in the actual editor webview.
    for (const width of [360, 700, 1200]) {
      await page.setViewportSize({ width: width + 48, height: 950 });
      await settle();
      const geometry = await mcp.evaluate(() => ({
        viewport: innerWidth,
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      assert.ok(
        geometry.scroll <= geometry.client + 2,
        JSON.stringify(geometry),
      );
      matrix.push({ view: "mcp", targetWidth: width, ...geometry });
      await shot("mcp-width-" + width);
    }
    await vscode.workspace
      .getConfiguration("window")
      .update(
        "zoomLevel",
        Math.log(2) / Math.log(1.2),
        vscode.ConfigurationTarget.Global,
      );
    await settle();
    assert.equal(await mcp.locator("#reload").isVisible(), true);
    await shot("mcp-zoom200");
    await vscode.workspace
      .getConfiguration("window")
      .update("zoomLevel", 0, vscode.ConfigurationTarget.Global);
    await page.setViewportSize({ width: 1280, height: 950 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await settle();
    await mcp.locator("#intent-NETBOX_TOKEN").press("r");
    await mcp.locator("#value-NETBOX_TOKEN").waitFor({ state: "visible" });
    mark(
      "MCP responsive widths,200% zoom and keyboard-only field selection; reduced-motion emulation",
    );
    const securityTargets = JSON.parse(
      fs.readFileSync(path.join(root, "security-targets.json"), "utf8"),
    );
    for (const product of ["defenseclaw", "openshell"]) {
      const kind = product === "defenseclaw" ? "security" : "openshell";
      const securityPanel = await vscode.commands.executeCommand(
        product === "defenseclaw"
          ? "netclaw.openSecurity"
          : "netclaw.openOpenShell",
      );
      const sf = await frameFor(`body[data-kind="${kind}"]`);
      await sf
        .locator("#status")
        .filter({ hasText: /Observed result/ })
        .waitFor();
      await sf.locator("#bind").click();
      const target = securityTargets[product].target;
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
              ["OpenShell workspace", target.workspace],
              ["OpenShell sandbox", target.sandbox],
            ]
          : []),
      ]) {
        await page.getByText(title, { exact: true }).waitFor();
        await input.fill(value);
        await input.press("Enter");
      }
      await page
        .getByRole("button", { name: "Bind security target", exact: true })
        .click();
      await sf
        .locator("#status")
        .filter({ hasText: /Security policy loaded/ })
        .waitFor({ timeout: 30000 });
      assert.ok(
        !(await sf.locator("body").textContent()).includes(
          "fixture-hidden-token",
        ),
      );
      if (product === "defenseclaw") {
        await typeAndCheck(page, sf, "#tool-name", "editor_read", 35);
        await sf.locator("#tool-connector").selectOption("openclaw");
        await sf.locator("#tool-action").selectOption("allow");
        await typeAndCheck(
          page,
          sf,
          "#security-reason",
          "Reviewed fixture access",
          35,
        );
        await sf
          .getByRole("button", { name: "Preview tool rule", exact: true })
          .press("Enter");
      } else {
        await typeAndCheck(page, sf, "#network-name", "reviewed_endpoint", 35);
        await typeAndCheck(page, sf, "#network-host", "reviewed.example", 35);
        await typeAndCheck(page, sf, "#network-binary", "/usr/bin/curl", 35);
        await sf
          .getByRole("button", { name: "Add to network draft", exact: true })
          .press("Enter");
        await typeAndCheck(
          page,
          sf,
          "#security-reason",
          "Reviewed fixture egress",
          35,
        );
        await sf.locator("#preview-network").press("Enter");
      }
      await sf.locator("#security-review").waitFor({ state: "visible" });
      assert.match(
        await sf.locator("#review-difference").textContent(),
        /Before:/,
      );
      await sf.waitForFunction(
        () => document.activeElement.id === "apply-security",
      );
      await shot(product + "-review");
      const reviewGeometry = await sf
        .locator("#security-review")
        .evaluate((e) => ({
          top: e.getBoundingClientRect().top,
          bottom: e.getBoundingClientRect().bottom,
          viewport: innerHeight,
          apply: document
            .getElementById("apply-security")
            .getBoundingClientRect().top,
        }));
      assert.ok(
        reviewGeometry.bottom > 0 &&
          reviewGeometry.top < reviewGeometry.viewport,
        "Security review must intersect the viewport: " +
          JSON.stringify(reviewGeometry),
      );
      assert.ok(
        reviewGeometry.apply >= 0 &&
          reviewGeometry.apply < reviewGeometry.viewport,
        "Focused Apply must be visible: " + JSON.stringify(reviewGeometry),
      );
      const fixtureFile =
        product === "defenseclaw"
          ? securityTargets[product].config
          : securityTargets[product].state;
      const original = fs.readFileSync(fixtureFile, "utf8");
      await sf.waitForFunction(
        () => !document.getElementById("apply-security").disabled,
      );
      await sf.locator("#apply-security").press("Enter");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert.equal(fs.readFileSync(fixtureFile, "utf8"), original);
      await sf.waitForFunction(
        () => !document.getElementById("apply-security").disabled,
      );
      await sf.locator("#apply-security").press("Enter");
      await page
        .getByRole("button", {
          name: "Acknowledge weakening & apply",
          exact: true,
        })
        .click();
      await sf
        .locator("#status")
        .filter({ hasText: /verified/ })
        .waitFor({ timeout: 30000 });
      assert.notEqual(fs.readFileSync(fixtureFile, "utf8"), original);
      await auditLayout(sf, product + "-controls");
      await shot(product + "-controls");
      await sf
        .locator(product === "defenseclaw" ? "#tool-rule" : "#network-rule")
        .scrollIntoViewIfNeeded();
      await shot(product + "-forms");
      mark(
        product +
          ": native scope binding, editable rules, cancel preservation, weakening acknowledgment and verified fixture write",
      );
      securityPanel.dispose();
    }
    // Attributable synthetic BGP fixture exercises WebGL, controls and fallback.
    const topology = await vscode.commands.executeCommand(
        "netclaw.openDomain",
        "topology",
      ),
      graphFrame = await frameFor('body[data-kind="topology"]');
    const viewId = await graphFrame
      .locator("body")
      .getAttribute("data-view-id");
    await topology.webview.postMessage({
      viewId,
      data: {
        source: "synthetic acceptance BGP sessions",
        data: {
          available: true,
          local: { routerId: "192.0.2.1", as: 64500 },
          peers: [
            { peer: "192.0.2.2", state: "Established", as: 64501 },
            { peer: "192.0.2.3", state: "Idle", as: 64502 },
          ],
        },
      },
    });
    await graphFrame
      .locator("#graph-selection option")
      .nth(2)
      .waitFor({ state: "attached" });
    await graphFrame.locator("#graph-selection").selectOption("192.0.2.3");
    assert.match(
      await graphFrame.locator("#graph-detail").textContent(),
      /Idle/,
    );
    await graphFrame
      .getByRole("button", { name: "Zoom in", exact: true })
      .click();
    await graphFrame
      .getByRole("button", { name: "Zoom out", exact: true })
      .click();
    await graphFrame
      .getByRole("button", { name: "Hide graph", exact: true })
      .click();
    assert.equal(
      await graphFrame.locator(".topology-surface").isVisible(),
      false,
    );
    await graphFrame
      .getByRole("button", { name: "Show graph", exact: true })
      .click();
    await graphFrame
      .getByRole("button", { name: "Reset view", exact: true })
      .click();
    await auditLayout(graphFrame, "topology-populated");
    await shot("topology-3d");
    for (let n = 0; n < 12; n++) {
      await graphFrame.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("netclaw:observation", {
            detail: {
              kind: "topology",
              observation: structuredClone(
                window.netclawObservation.observation,
              ),
            },
          }),
        ),
      );
    }
    assert.equal(
      await graphFrame.locator(".topology-surface canvas").count(),
      1,
    );
    assert.equal(await graphFrame.locator(".graph-label").count(), 3);
    assert.equal(
      await graphFrame.locator("#graph-selection").inputValue(),
      "192.0.2.3",
    );
    mark("Repeated graph refresh keeps one canvas and current selection");
    const canvas = graphFrame.locator(".topology-surface canvas");
    if (await canvas.count()) {
      await canvas.evaluate((c) =>
        c.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
      );
      assert.equal(
        await graphFrame.locator("#graph-selection").isEnabled(),
        true,
      );
      assert.match(
        await graphFrame.locator(".topology-stage").textContent(),
        /3D is unavailable/,
      );
    }
    mark("Reported BGP node selection/controls and WebGL-loss text fallback");
    //500 entries measured in actual Chromium inside VS Code, after debounce.
    const integrationPanel = await vscode.commands.executeCommand(
        "netclaw.openIntegrations",
      ),
      i = await frameFor('body[data-kind="integrations"]'),
      iid = await i.locator("body").getAttribute("data-view-id");
    await i
      .locator("#status")
      .filter({ hasText: /Observed result/ })
      .waitFor();
    await integrationPanel.webview.postMessage({
      viewId: iid,
      data: {
        data: {
          integrations: Array.from({ length: 500 }, (_, n) => ({
            id: "fixture-" + n,
            name: "Fixture " + n,
            category: "Synthetic",
            description: "Synthetic acceptance only",
          })),
        },
      },
    });
    await i.locator("article").nth(49).waitFor();
    const timing = await i.evaluate(async () => {
      const content = document.getElementById("content"),
        filter = document.getElementById("filter"),
        start = performance.now();
      return new Promise((resolve) => {
        const observer = new MutationObserver(() => {
          observer.disconnect();
          resolve(performance.now() - start - 80);
        });
        observer.observe(content, { childList: true });
        filter.value = "fixture-499";
        filter.dispatchEvent(new Event("input"));
      });
    });
    assert.ok(timing < 250);
    matrix.push({
      view: "integrations",
      entries: 500,
      settledRenderMs: timing,
    });
    await shot("integration-cards");
    mark(
      "Actual editor500-entry search: " +
        timing.toFixed(1) +
        "ms after debounce",
    );
    for (const [command, kind, selector] of [
      ["netclaw.openChat", "chat", "#composer"],
      ["netclaw.openCanvas", "canvas", "#save"],
      ["netclaw.openRag", "rag", "#rag-search"],
      ["netclaw.openAvatar", "avatar", "#avatar-character"],
    ]) {
      const special = await vscode.commands.executeCommand(command);
      const frame = await frameFor(`body[data-kind="${kind}"]`);
      await frame.locator(selector).waitFor({ state: "visible" });
      await auditLayout(frame, kind);
      await shot("family-" + kind);
      special?.dispose();
    }
    mark(
      "Every view family checked in three themes/widths, 200% zoom, keyboard focus and reduced motion",
    );
    api.connection.disconnect();
    testbed.reveal();
    await tb
      .locator("#status")
      .filter({ hasText: /Connection changed/ })
      .waitFor();
    assert.equal(await tb.locator("#yaml").inputValue(), "");
    mark("Connection invalidation clears sensitive drafts");
  } catch (error) {
    await shot("acceptance-failure");
    fs.writeFileSync(
      path.join(reportDir, "failure-ui.txt"),
      await page.locator("body").innerText(),
    );
    throw error;
  } finally {
    await browser.close();
  }
  fs.writeFileSync(
    process.env.NETCLAW_TEST_REPORT,
    JSON.stringify(
      {
        editor: vscode.version,
        packageMode: process.env.NETCLAW_TEST_INSTALLED_ROOT
          ? "exact installed VSIX; isolated native observer"
          : "source development; isolated native observer",
        platform: process.platform,
        remote: vscode.env.remoteName || null,
        checks,
        matrix,
        screenshots: shots,
        scope:
          "Synthetic data and isolated source HUD; no real provider or network-device calls. Security mutations target isolated CLI fixtures.",
      },
      null,
      2,
    ),
  );
};
