import assert from "node:assert/strict";
import { intentActivity } from '../src/canvas-chat/intent-activity.js';
import {
  buildTerminalIntentMessages,
  normalizeTerminalCommandOutput,
  normalizeTerminalIntentHistory,
  parseTerminalIntentResponse,
  shouldAutoRunTerminalIntent,
  terminalCommandRisk,
  terminalCommandsToInput,
} from "../src/canvas-chat/terminal-intent.js";

const proposal = parseTerminalIntentResponse(`\`\`\`json
{
  "intent": "Check the BGP neighbor state.",
  "explanation": "This reads the current BGP summary without changing configuration.",
  "commands": ["show ip bgp summary"],
  "risk": "read-only",
  "assumptions": ["The device uses Cisco IOS-style CLI."]
}
\`\`\``);
assert.equal(proposal.commands[0], "show ip bgp summary");
assert.equal(proposal.risk, "read-only");

const understated = parseTerminalIntentResponse(JSON.stringify({
  intent: "Restart the device.",
  explanation: "A restart interrupts service.",
  commands: ["reload"],
  risk: "read-only",
  assumptions: [],
}));
assert.equal(understated.risk, "destructive");
assert.equal(terminalCommandRisk(["configure terminal", "interface GigabitEthernet1"]), "configuration");
assert.equal(terminalCommandRisk(["unrecognized vendor command"]), "unknown");
assert.equal(terminalCommandRisk(["unrecognized vendor command", "reload"]), "destructive");

assert.throws(
  () => parseTerminalIntentResponse(JSON.stringify({
    intent: "Bad command",
    explanation: "Invalid",
    commands: ["show version\nreload"],
    risk: "read-only",
    assumptions: [],
  })),
  /multi-line command/,
);

const prose = parseTerminalIntentResponse("The interface is administratively down and is not forwarding traffic.");
assert.deepEqual(prose.commands, []);
assert.match(prose.explanation, /administratively down/);

const messages = buildTerminalIntentMessages({
  request: "Why is this interface down?",
  transcript: "GigabitEthernet1 is administratively down",
  device: { id: "R1", os: "iosxe", connectionStatus: "connected" },
});
assert.equal(messages.length, 1);
assert.equal(messages[0].role, "user");
assert.match(messages[0].content, /Never claim that a command ran/);
assert.match(messages[0].content, /untrusted context/);
assert.match(messages[0].content, /Why is this interface down/);

assert.equal(terminalCommandsToInput(["show version", "show clock"]), "show version\rshow clock\r");
assert.equal(
  normalizeTerminalCommandOutput("\u001b[32mshow logging\r\nLog Buffer:\r\n%LINK-3-UPDOWN\u001b[0m\r\nR1# "),
  "show logging\nLog Buffer:\n%LINK-3-UPDOWN\nR1#",
);
assert.equal(shouldAutoRunTerminalIntent(proposal, { connectionStatus: "connected" }), true);
assert.equal(shouldAutoRunTerminalIntent(proposal, { connectionStatus: "disconnected" }), false);
assert.equal(shouldAutoRunTerminalIntent(proposal, { connectionStatus: "connected", explainOnly: true }), false);
assert.equal(shouldAutoRunTerminalIntent(understated, { connectionStatus: "connected" }), false);

assert.deepEqual(normalizeTerminalIntentHistory([
  { id: "u1", role: "user", content: " show interfaces " },
  { id: "bad", role: "assistant", content: "", proposal: { commands: ["show version\nreload"] } },
]), [
  { id: "u1", role: "user", content: "show interfaces" },
]);
const capturedHistory = normalizeTerminalIntentHistory([{
  id: "result-1",
  role: "assistant",
  content: "The device reported two buffered log messages.",
  proposal: { ...proposal, commands: [] },
  executedCommands: ["show logging"],
  terminalOutput: "\u001b[32mLog Buffer:\u001b[0m\r\n%LINK-3-UPDOWN",
}]);
assert.deepEqual(capturedHistory[0].executedCommands, ["show logging"]);
assert.equal(capturedHistory[0].terminalOutput, "Log Buffer:\n%LINK-3-UPDOWN");

console.log("Terminal intent tests passed.");

for (const phase of ['request', 'capture', 'summary']) {
  assert.equal(intentActivity({ phase }).busy, true);
}
assert.match(intentActivity({ phase: 'request' }).detail, /Detailed model progress is not available/);
assert.match(intentActivity({ phase: 'summary' }).detail, /will not automatically continue/);
assert.match(intentActivity({ message: capturedHistory[0] }).title, /stopped here/);
assert.equal(intentActivity({ message: capturedHistory[0] }).busy, undefined);
const configMessage = { role: 'assistant', content: 'Review this change', proposal: {
  ...proposal, risk: 'configuration', commands: ['configure terminal', 'interface Loopback10', 'description EXAMPLE'],
} };
assert.match(intentActivity({ message: configMessage, connected: true }).title, /Waiting for your configuration review/);
assert.match(intentActivity({ message: configMessage }).detail, /Connect to the device first/);
assert.equal(shouldAutoRunTerminalIntent(configMessage.proposal, { connectionStatus: 'connected' }), false);
const sentMessage = { ...configMessage, execution: { status: 'reviewed-sent', message: 'Sent after review' } };
assert.equal(normalizeTerminalIntentHistory([sentMessage])[0].execution.status, 'reviewed-sent');
assert.match(intentActivity({ message: sentMessage }).detail, /has not been verified/);
assert.match(intentActivity({ phase: 'summary', error: 'Timed out' }).title, /Stopped/);
assert.equal(intentActivity({ phase: 'summary', error: 'Timed out' }).busy, undefined);
assert.match(intentActivity({ message: { execution: { status: 'not-connected' } } }).detail, /submit the request again/);
assert.match(intentActivity({ message: { execution: { status: 'sent' } } }).detail, /No active collection/);
console.log('Intent workflow states distinguish pending work, review, stopped verification, and unverified sends.');
