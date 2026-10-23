import assert from "node:assert/strict";
import yamlParser from "js-yaml";
import {
  ARTIFACT_FORMATS,
  artifactFormat,
  buildTerminalArtifact,
  validateArtifactContent,
} from "../src/canvas-chat/artifact-formats.js";

assert.deepEqual(
  ARTIFACT_FORMATS.map((format) => format.id),
  ["json", "jsonl", "yaml", "xml", "csv", "raw"],
);
assert.equal(artifactFormat("missing").id, "json");

const source = "interface GigabitEthernet1\n description Customer Edge\n no shutdown";
const json = buildTerminalArtifact({ source, format: "json", device: "Lab" });
assert.equal(json.name, "Lab-output.json");
assert.equal(json.validation.status, "valid");
assert.equal(json.structure, "hierarchical");
assert.equal(json.records, 3);
assert.equal(JSON.parse(json.content).device, "Lab");
assert.deepEqual(JSON.parse(json.content).sections, [
  {
    command: "interface GigabitEthernet1",
    children: [
      { command: "description Customer Edge" },
      { command: "no shutdown" },
    ],
  },
]);

const jsonl = buildTerminalArtifact({ source, format: "jsonl", device: "Lab" });
assert.equal(jsonl.validation.status, "valid");
assert.doesNotMatch(jsonl.content, /"line":/);
assert.equal(JSON.parse(jsonl.content.trim()).command, "interface GigabitEthernet1");
assert.equal(JSON.parse(jsonl.content.trim()).children.length, 2);

const yaml = buildTerminalArtifact({ source, format: "yaml", device: "Lab" });
assert.equal(yaml.validation.status, "valid");
assert.match(yaml.content, /^source: "terminal"/);
assert.match(yaml.content, /device: "Lab"/);
assert.equal(yamlParser.load(yaml.content).sections[0].children[0].command, "description Customer Edge");

const xml = buildTerminalArtifact({ source, format: "xml", device: "Lab" });
assert.equal(xml.validation.status, "valid");
assert.match(xml.content, /<artifact>/);
assert.match(xml.content, /<sections>/);
assert.match(xml.content, /<children>/);

const csv = buildTerminalArtifact({ source, format: "csv", device: "Lab" });
assert.equal(csv.validation.status, "valid");
assert.match(csv.content, /^parent,command/);
assert.doesNotMatch(csv.content, /^line,/);
assert.match(csv.content, /interface GigabitEthernet1,description Customer Edge/);

const flat = buildTerminalArtifact({
  source: "Cisco IOS XE Software\nUptime is 3 days",
  format: "json",
  device: "Lab",
});
assert.equal(flat.structure, "flat");
assert.deepEqual(JSON.parse(flat.content).entries, [
  "Cisco IOS XE Software",
  "Uptime is 3 days",
]);

const deep = buildTerminalArtifact({
  source: "router bgp 65000\n address-family ipv4\n  network 10.0.0.0 mask 255.255.255.0\n!\nline vty 0 4\n transport input ssh",
  format: "json",
  device: "R1",
});
const deepSections = JSON.parse(deep.content).sections;
assert.equal(deep.structure, "hierarchical");
assert.equal(deepSections[0].command, "router bgp 65000");
assert.equal(deepSections[0].children[0].command, "address-family ipv4");
assert.equal(deepSections[0].children[0].children[0].command, "network 10.0.0.0 mask 255.255.255.0");
assert.equal(deepSections[1].command, "line vty 0 4");
assert.equal(deepSections[1].children[0].command, "transport input ssh");

const passthrough = buildTerminalArtifact({
  source: '[{"id":1,"name":"R1"},{"id":2,"name":"R2"}]',
  format: "csv",
  name: "inventory",
});
assert.equal(passthrough.name, "inventory.csv");
assert.match(passthrough.content, /^id,name/);
assert.equal(passthrough.records, 2);

const punctuation = buildTerminalArtifact({
  source: 'description Customer: "A&B", primary\nbanner login ^C<authorized users only>^C',
  format: "xml",
  device: "R&D",
});
assert.equal(punctuation.validation.status, "valid");
assert.match(punctuation.content, /A&amp;B/);
assert.match(punctuation.content, /&lt;authorized users only&gt;/);

const malformed = [
  ["json", '{"device": }'],
  ["jsonl", '{"line":1}\nnot-json\n'],
  ["yaml", "device: [R1\n"],
  ["xml", "<?xml version=\"1.0\"?><artifact><device>R1</artifact>"],
  ["csv", "line,text\n1,\"unterminated\n"],
  ["csv", "line,text\n1,ok,extra\n"],
];
malformed.forEach(([format, content]) => {
  const validation = validateArtifactContent(content, format);
  assert.equal(validation.status, "invalid", `${format} should be rejected`);
  assert.ok(validation.message, `${format} should include a validation error`);
});
assert.equal(validateArtifactContent("plain terminal output", "raw").status, "valid");

console.log("Artifact format tests passed.");
