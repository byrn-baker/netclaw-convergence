import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestbedDocument } from "../testbed-document.js";
import { parse } from "yaml";
const source =
  "# preserve this comment\ntestbed:\n  credentials:\n    default:\n      username: admin\n      password: synthetic-secret-151\ndevices:\n  R1:\n    os: iosxe\n    custom: {owner: engineering}\n    connections:\n      cli: {protocol: ssh, ip: 192.0.2.1, port: 22}\n      console: {protocol: telnet, host: 192.0.2.2, port: 2001}\n";
function fixture(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nc151-testbed-")),
    file = path.join(dir, "testbed.yaml");
  fs.writeFileSync(file, source);
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const revoked = [];
  const service = createTestbedDocument({
    file,
    installationId: "fixture",
    runtime: "openclaw",
    revoke: (id) => revoked.push(id),
    ...options,
  });
  return { file, service, revoked };
}
function request(service, operation) {
  const s = service.snapshot();
  return { targetId: s.targetId, revision: s.revision, operation };
}
function commit(service, operation) {
  const r = request(service, operation),
    p = service.preview(r);
  return service.commit({ ...r, digest: p.digest, confirm: true });
}
test("pyATS defaults stay out of endpoint cards/CSV and cannot be overwritten by guided endpoint edits", (t) => {
  const { service, file } = fixture(t);
  const defaults = {
    class: "unicon.Unicon",
    arguments: { init_exec_commands: [] },
  };
  const connections = {
    defaults,
    ssh: {
      protocol: "ssh",
      ip: "192.0.2.101",
      port: 22,
      ssh_options: "preserve",
    },
  };
  fs.writeFileSync(
    file,
    JSON.stringify({ devices: { R1: { os: "iosxe", connections } } }),
  );
  assert.deepEqual(
    service.snapshot().devices[0].connections.map((c) => c.name),
    ["ssh"],
  );
  assert.ok(
    !service
      .export({
        ...request(service, {}),
        format: "csv",
        credentials: "redacted",
      })
      .content.includes("defaults"),
  );
  const operation = {
    type: "update",
    id: "R1",
    connection: "defaults",
    endpoint: { host: "192.0.2.9", protocol: "ssh" },
  };
  const before = fs.readFileSync(file, "utf8");
  assert.throws(
    () => service.preview(request(service, operation)),
    /shared pyATS settings/,
  );
  assert.equal(fs.readFileSync(file, "utf8"), before);
  commit(service, { ...operation, connection: "ssh" });
  const saved = parse(fs.readFileSync(file, "utf8")).devices.R1.connections;
  assert.deepEqual(saved.defaults, defaults);
  assert.deepEqual(saved.ssh, { ...connections.ssh, ip: "192.0.2.9" });
});
test("masked read, read-only preview, CST guided update, private baseline and stale rejection", (t) => {
  const { service, file, revoked } = fixture(t);
  const s = service.snapshot();
  assert.ok(!JSON.stringify(s).includes("synthetic-secret"));
  assert.ok(s.content.includes("__NETCLAW_KEEP_"));
  const r = request(service, {
    type: "update",
    id: "R1",
    fields: { alias: "Core" },
    connection: "cli",
    endpoint: { host: "192.0.2.9" },
  });
  const p = service.preview(r);
  assert.deepEqual(revoked, []);
  assert.equal(fs.readFileSync(file, "utf8"), source);
  service.commit({ ...r, digest: p.digest, confirm: true });
  const next = fs.readFileSync(file, "utf8");
  assert.ok(next.includes("# preserve"));
  assert.ok(next.includes("synthetic-secret"));
  assert.ok(next.includes("console:"));
  assert.ok(next.includes("owner: engineering"));
  assert.deepEqual(revoked, ["R1"]);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.throws(
    () => service.commit({ ...r, digest: p.digest, confirm: true }),
    /changed/,
  );
  const back = service.snapshot().backups[0];
  assert.equal(
    fs.statSync(path.join(file + ".backups", back.id)).mode & 0o777,
    0o600,
  );
  commit(service, { type: "restore", id: back.id });
  assert.equal(fs.readFileSync(file, "utf8"), source);
});
test("CRUD, advanced secret keep tokens and YAML/JSON/CSV roundtrips", (t) => {
  const { service, file } = fixture(t);
  commit(service, {
    type: "create",
    id: "R2",
    fields: { os: "iosxe" },
    connection: "cli",
    endpoint: { protocol: "ssh", host: "192.0.2.3", port: 22 },
  });
  let s = service.snapshot();
  commit(service, {
    type: "document",
    content: s.content.replace("iosxe", "ios"),
  });
  assert.ok(fs.readFileSync(file, "utf8").includes("synthetic-secret"));
  const csv = service.export({
    ...request(service, {}),
    format: "csv",
    credentials: "redacted",
  });
  assert.ok(csv.content.includes("console"));
  commit(service, { type: "import", format: "csv", content: csv.content });
  for (const format of ["yaml", "json"]) {
    const exp = service.export({
      ...request(service, {}),
      format,
      credentials: "include",
    });
    commit(service, {
      type: "import",
      format,
      mode: "replace",
      content: exp.content,
    });
  }
  commit(service, { type: "remove", id: "R2" });
  assert.equal(service.snapshot().devices.length, 1);
});
test("refuses token transplantation, invalid data, duplicate CSV keys and unsafe aliases", (t) => {
  const { service, file } = fixture(t);
  let s = service.snapshot();
  const token = s.content.match(/__NETCLAW_KEEP_[a-f0-9]+/)[0];
  assert.throws(
    () =>
      service.preview(
        request(service, {
          type: "document",
          content: s.content + "custom: " + token + "\n",
        }),
      ),
    /token/,
  );
  for (const content of [
    "devices: []",
    "devices: {R1: {}, R1: {}}",
    "devices: !!python/object {}",
    "devices: {__proto__: {}}",
  ])
    assert.throws(() =>
      service.preview(request(service, { type: "document", content })),
    );
  assert.throws(
    () =>
      service.preview(
        request(service, {
          type: "import",
          format: "csv",
          content: "id,connection,host\nR1,cli,192.0.2.4\nR1,cli,192.0.2.5",
        }),
      ),
    /row|duplicate/i,
  );
  assert.equal(fs.readFileSync(file, "utf8"), source);
});
test("active sessions and failed revocation prevent writes; write fault preserves backup and reports consent", (t) => {
  const f = fixture(t, { isActive: () => true });
  assert.throws(
    () => commit(f.service, { type: "remove", id: "R1" }),
    /terminal/i,
  );
  assert.equal(fs.readFileSync(f.file, "utf8"), source);
  const g = fixture(t, {
    revoke: () => {
      throw Error("sentinel-secret");
    },
  });
  assert.throws(
    () => commit(g.service, { type: "remove", id: "R1" }),
    /Unable|consent/i,
  );
  assert.equal(fs.readFileSync(g.file, "utf8"), source);
  const h = fixture(t, {
    write: () => {
      throw Error("sentinel-secret");
    },
  });
  assert.throws(
    () => commit(h.service, { type: "remove", id: "R1" }),
    /consent.*revoked/i,
  );
  assert.equal(fs.readFileSync(h.file, "utf8"), source);
  assert.equal(h.service.snapshot().backups.length, 1);
});

test("numeric credentials remain masked; string device keys and CSV edge cases are explicit", (t) => {
  const { service, file } = fixture(t);
  fs.writeFileSync(
    file,
    'devices:\n  router:\n    os: iosxe\n    credentials:\n      default: {password: 99887766, enable: false, username: "%ENV{USER}"}\n    connections:\n      cli: {protocol: ssh, host: 192.0.2.1}\n',
  );
  const s = service.snapshot();
  assert.ok(!s.content.includes("99887766"));
  assert.ok(s.content.includes("%ENV{USER}"));
  commit(service, {
    type: "document",
    content: s.content + "# comment retained\n",
  });
  assert.ok(fs.readFileSync(file, "utf8").includes("password: 99887766"));
  assert.ok(fs.readFileSync(file, "utf8").includes("# comment retained"));
  assert.throws(
    () =>
      service.preview(
        request(service, { type: "document", content: "devices: {123: {}}" }),
      ),
    /string keys/,
  );
  const csv =
    '\ufeffid,alias,connection,protocol,host,port\r\nrouter,"Core, ""quoted""",cli,ssh,192.0.2.2,\r\n';
  commit(service, { type: "import", format: "csv", content: csv });
  assert.equal(service.snapshot().devices[0].alias, 'Core, "quoted"');
  assert.ok(fs.readFileSync(file, "utf8").includes("99887766"));
  for (const content of [
    "id,id\nx,x",
    "id,unexpected\nx,y",
    'id,connection,host\nrouter,cli,"unclosed',
  ])
    assert.throws(() =>
      service.preview(
        request(service, { type: "import", format: "csv", content }),
      ),
    );
});

test("operation fields are allowlisted without dropping unintended changes", (t) => {
  const { service, file } = fixture(t);
  assert.throws(
    () =>
      service.preview(
        request(service, {
          type: "update",
          id: "R1",
          fields: { alias: "new" },
          credentials: { password: "not-allowed" },
        }),
      ),
    /Unknown testbed operation field/,
  );
  assert.equal(fs.readFileSync(file, "utf8"), source);
});

test("YAML/JSON merge conflicts are explicit; redacted copies and CSV preserve their documented limits", (t) => {
  const { service, file } = fixture(t);
  for (const format of ["yaml", "json"]) {
    const content =
      format === "yaml"
        ? "devices:\n  R1: {os: nxos}\n  R2: {os: iosxe}\n"
        : JSON.stringify({
            devices: { R1: { os: "nxos" }, R2: { os: "iosxe" } },
          });
    assert.throws(
      () =>
        service.preview(
          request(service, {
            type: "import",
            format,
            content,
            mode: "merge",
            conflicts: "error",
          }),
        ),
      /Duplicate/,
    );
    commit(service, {
      type: "import",
      format,
      content,
      mode: "merge",
      conflicts: "skip",
    });
    assert.match(fs.readFileSync(file, "utf8"), /os: iosxe/);
    assert.ok(fs.readFileSync(file, "utf8").includes("synthetic-secret-151"));
    const redacted = service.export({
      ...request(service, {}),
      format,
      credentials: "redacted",
    });
    assert.ok(!redacted.content.includes("synthetic-secret-151"));
    assert.ok(redacted.limitations.length > 0);
  }
  commit(service, {
    type: "import",
    format: "json",
    content: JSON.stringify({ devices: { R1: { os: "nxos" } } }),
    mode: "merge",
    conflicts: "replace",
  });
  assert.equal(
    service.snapshot().devices.find((d) => d.id === "R1").os,
    "nxos",
  );
  assert.ok(service.snapshot().devices.some((d) => d.id === "R2"));
  assert.throws(
    () =>
      service.preview(
        request(service, {
          type: "import",
          format: "yaml",
          content: "testbed: {name: changed}\ndevices: {}",
          mode: "merge",
          conflicts: "skip",
        }),
      ),
    /devices only/,
  );
});
