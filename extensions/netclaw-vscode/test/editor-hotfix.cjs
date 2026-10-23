const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async ({ vscode, page, frameFor, root, mark, shot }) => {
  const file = path.join(root, "testbed/testbed.yaml");
  const original = fs.readFileSync(file, "utf8");
  const devices = Object.fromEntries(
    Array.from({ length: 60 }, (_, i) => [
      `router-${String(i).padStart(2, "0")}`,
      {
        os: "iosxe",
        alias: `Lab router ${i}`,
        connections: {
          cli: { protocol: "ssh", ip: `192.0.2.${i + 1}`, port: 22 },
          console: { protocol: "telnet", ip: "192.0.2.254", port: 2000 + i },
        },
        credentials: {
          default: { username: "fixture", password: "synthetic-hotfix-secret" },
        },
      },
    ]),
  );
  fs.writeFileSync(file, JSON.stringify({ devices }));
  const panel = await vscode.commands.executeCommand("netclaw.openNetwork");
  try {
    const frame = await frameFor('body[data-kind="testbed"]');
    await frame
      .locator("#status")
      .filter({ hasText: /Testbed loaded/ })
      .waitFor();
    await frame
      .getByRole("button", { name: "Edit device", exact: true })
      .first()
      .click();
    await frame.locator("#device-form").waitFor({ state: "visible" });
    await frame.waitForFunction(
      () => !document.getElementById("device-alias").disabled,
    );
    const result = await frame.evaluate(() => {
      const form = document.getElementById("device-form");
      return {
        top: form.getBoundingClientRect().top,
        viewport: innerHeight,
        focus: document.activeElement.id,
        id: document.getElementById("device-id").value,
      };
    });
    await shot("hotfix-existing-device-edit");
    assert.equal(result.id, "router-00");
    assert.ok(
      // Chromium scroll offsets are rounded to device pixels on Windows.
      result.top >= -1 && result.top < result.viewport - 80,
      "Edit must bring the existing-device form into view: " +
        JSON.stringify(result),
    );
    assert.equal(
      result.focus,
      "device-alias",
      "Edit must focus an enabled editable field",
    );
    mark(
      "Hotfix: existing-device Edit opens in view and focuses an editable field with 60 devices",
    );
    await frame.locator("#device-alias").fill("");
    await frame
      .locator("#device-alias")
      .pressSequentially("Updated lab router", { delay: 25 });
    assert.equal(
      await frame.locator("#device-alias").inputValue(),
      "Updated lab router",
    );
    assert.equal(
      await frame.evaluate(() => document.activeElement.id),
      "device-alias",
    );
    await frame.locator("#connection-choice").selectOption("console");
    assert.equal(await frame.locator("#device-port").inputValue(), "2000");
    await frame.locator("#device-port").fill("2300");
    await frame
      .getByRole("button", { name: "Preview device change", exact: true })
      .click();
    await frame.waitForFunction(() => document.activeElement.id === "save");
    assert.equal(fs.readFileSync(file, "utf8"), JSON.stringify({ devices }));
    assert.equal(
      await frame
        .locator("#review")
        .evaluate(
          (e) =>
            e.getBoundingClientRect().top >= -1 &&
            e.getBoundingClientRect().top < innerHeight,
        ),
      true,
    );
    await frame.locator("#cancel-review").click();
    assert.equal(await frame.locator("#review").isVisible(), false);
    await frame
      .getByRole("button", { name: "Preview device change", exact: true })
      .click();
    await frame.locator("#save").click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(fs.readFileSync(file, "utf8"), JSON.stringify({ devices }));
    await frame.locator("#save").click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await frame
      .locator("#status")
      .filter({ hasText: /saved and verified/ })
      .waitFor();
    const YAML = require(path.join(__dirname, "../node_modules/yaml"));
    const edited = YAML.parse(fs.readFileSync(file, "utf8")).devices[
      "router-00"
    ];
    assert.equal(edited.alias, "Updated lab router");
    assert.equal(edited.connections.console.port, 2300);
    assert.deepEqual(
      edited.connections.cli,
      devices["router-00"].connections.cli,
    );
    assert.deepEqual(edited.credentials, devices["router-00"].credentials);
    mark(
      "Hotfix: continuous typing, connection edit, visible preview, cancel/review/save and preservation of credentials and other connections",
    );
    await frame.locator("#recover").click();
    await page
      .getByText("Preview a private recovery copy", { exact: true })
      .waitFor();
    await page.locator(".quick-input-widget input").press("Enter");
    await frame.waitForFunction(() => document.activeElement.id === "save");
    await frame.locator("#cancel-review").click();
    await frame.locator("#next").click();
    assert.match(await frame.locator("#count").textContent(), /51–60 of 60/);
    await frame.locator("#previous").click();
    assert.match(await frame.locator("#count").textContent(), /1–50 of 60/);
    await frame.locator("#filter").fill("router-59");
    await frame.getByRole("button", { name: "Remove", exact: true }).click();
    await frame.locator("#save").click();
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await frame
      .locator("#status")
      .filter({ hasText: /saved and verified/ })
      .waitFor();
    assert.equal(
      YAML.parse(fs.readFileSync(file, "utf8")).devices["router-59"],
      undefined,
    );
    await frame.locator("#filter").fill("");
    await frame.locator("#add").click();
    await frame.waitForFunction(
      () => document.activeElement.id === "device-id",
    );
    await frame.locator("#cancel-form").click();
    await frame.locator("#device-form").waitFor({ state: "hidden" });
    await frame.locator("#yaml-mode").click();
    await frame.waitForFunction(() => document.activeElement.id === "yaml");
    await frame.locator("#cards-mode").click();
    await frame.waitForFunction(() => document.activeElement.id === "filter");
    mark(
      "Hotfix: recovery preview/cancel, next/previous/search, reviewed removal, Add/Close and YAML/cards navigation",
    );
  } finally {
    panel.dispose();
    fs.writeFileSync(file, original);
  }
};
