import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileFixture } from "./claw-fixture.mjs";
import { resolveTarget } from "../../../scripts/lib/claw-files.mjs";
import { discoverSystemdServices } from "../../../scripts/lib/claw-services.mjs";

function unit(
  f,
  {
    environment = "",
    contents,
    name = "gateway.systemd.env",
    optional = false,
  } = {},
) {
  const file = path.join(f.home, name);
  if (contents !== undefined) fs.writeFileSync(file, contents, { mode: 0o600 });
  const fragment = path.join(f.base, "openclaw-gateway.service");
  fs.writeFileSync(fragment, "[Service]\nExecStart=synthetic\n", {
    mode: 0o600,
  });
  return [
    "Id=openclaw-gateway.service",
    "FragmentPath=" + fragment,
    "DropInPaths=",
    "Environment=" + environment,
    `EnvironmentFiles=${file} (ignore_errors=${optional ? "yes" : "no"})`,
    `ExecStart={ path=${f.target.cli} ; argv[]=${f.target.cli} gateway ; ignore_errors=no ; }`,
    "NeedDaemonReload=no",
    "LoadState=loaded",
  ].join("\n");
}
const scope = (f) =>
  `OPENCLAW_STATE_DIR=${f.home}\nOPENCLAW_CONFIG_PATH=${f.target.configPath}\n`;
function transport(definitions) {
  return async (bin, args) => {
    assert.equal(bin, "/usr/bin/systemctl");
    assert.equal(args[0], "--user");
    if (args[1] === "list-unit-files")
      return Object.keys(definitions)
        .map((n) => n + " enabled")
        .join("\n");
    assert.equal(args[1], "show", "discovery never changes a manager");
    assert.ok(Object.hasOwn(definitions, args[2]));
    return definitions[args[2]];
  };
}

test("systemd discovery ignores a proven foreign OpenClaw gateway environment before selected-home qualification", async () => {
  const selected = fileFixture(),
    neighbor = fileFixture();
  const raw = unit(neighbor, { contents: scope(neighbor) });
  assert.deepEqual(
    await discoverSystemdServices(
      await resolveTarget(selected.target),
      transport({ "openclaw-gateway.service": raw }),
    ),
    [],
  );
});

test("Hermes discovery never inspects an OpenClaw-only gateway definition", async () => {
  const f = fileFixture("hermes");
  const run = transport({
    "openclaw-gateway.service":
      "EnvironmentFiles=/unqualified/file (ignore_errors=no)",
  });
  assert.deepEqual(
    await discoverSystemdServices(await resolveTarget(f.target), run),
    [],
  );
});

test("literal unquoted spaces and interior quotes do not block neighboring or selected gateways", async () => {
  const selected = fileFixture(), neighbor = fileFixture();
  for (const f of [selected, neighbor]) {
    const raw = unit(f, {
      contents: scope(f) + `LABEL=literal interior spaces\nNAME=claw's "label"\nEMPTY=\n`,
    });
    const found = await discoverSystemdServices(
      await resolveTarget(selected.target),
      transport({ "openclaw-gateway.service": raw }),
    );
    assert.equal(found.length, f === selected ? 1 : 0);
    assert.ok(!JSON.stringify(found).includes("interior spaces"));
  }
});

test("selected gateway.systemd.env is private, hashed, and qualified using literal effective scope", async () => {
  const f = fileFixture(),
    t = await resolveTarget(f.target);
  const raw = unit(f, { contents: scope(f) + 'LABEL="a # literal value"\n' });
  const [d] = await discoverSystemdServices(
    t,
    transport({ "openclaw-gateway.service": raw }),
  );
  assert.equal(d.controller, "systemd");
  assert.equal(d.unit, "openclaw-gateway.service");
  assert.ok(
    d.inputs.some(([p]) => p === path.join(f.home, "gateway.systemd.env")),
  );
  assert.equal(d.installationId, t.installationId);
  assert.ok(
    !JSON.stringify(d).includes("literal value"),
    "environment values are not projected",
  );
});

test("environment files override inline foreign scope; selected service is not silently skipped", async () => {
  const f = fileFixture(),
    neighbor = fileFixture();
  const raw = unit(f, {
    environment: `OPENCLAW_STATE_DIR=${neighbor.home} OPENCLAW_CONFIG_PATH=${neighbor.target.configPath}`,
    contents: scope(f),
  });
  assert.equal(
    (
      await discoverSystemdServices(
        await resolveTarget(f.target),
        transport({ "openclaw-gateway.service": raw }),
      )
    ).length,
    1,
  );
});

test("conflicting home/config scope refuses instead of omitting a possible owner", async () => {
  const f = fileFixture(),
    neighbor = fileFixture();
  const raw = unit(f, {
    contents: `OPENCLAW_STATE_DIR=${neighbor.home}\nOPENCLAW_CONFIG_PATH=${f.target.configPath}\n`,
  });
  await assert.rejects(
    discoverSystemdServices(
      await resolveTarget(f.target),
      transport({ "openclaw-gateway.service": raw }),
    ),
    /conflicting installation scope/,
  );
});

test("unsupported, missing, non-private and external environment files refuse without manager mutation", async () => {
  const f = fileFixture(),
    t = await resolveTarget(f.target),
    neighbor = fileFixture();
  for (const [raw, pattern] of [
    [
      unit(f, { name: "custom.env", contents: scope(f) }),
      /unqualified environment/,
    ],
    [unit(f, { name: ".env" }), /Required native environment file is missing/],
    [unit(neighbor, { contents: scope(f) }), /outside its home/],
  ])
    await assert.rejects(
      discoverSystemdServices(
        t,
        transport({ "openclaw-gateway.service": raw }),
      ),
      pattern,
    );
  const raw = unit(f, { contents: scope(f) + 'OTHER="escaped\\nvalue"\n' });
  await assert.rejects(
    discoverSystemdServices(t, transport({ "openclaw-gateway.service": raw })),
    /unsupported syntax/,
  );
  fs.writeFileSync(path.join(f.home, "gateway.systemd.env"), scope(f));
  fs.chmodSync(path.join(f.home, "gateway.systemd.env"), 0o644);
  await assert.rejects(
    discoverSystemdServices(t, transport({ "openclaw-gateway.service": raw })),
    /private|permission/i,
  );
});
