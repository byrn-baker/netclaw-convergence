import assert from 'node:assert/strict';
import { detectTerminalEnrichmentObjects } from '../src/canvas-chat/terminal-enrichment.js';
import { DnsPtrEnrichmentProvider, TerminalEnrichmentManager } from '../terminal-enrichment.js';

const values = detectTerminalEnrichmentObjects('via 10.1.1.2 and 2001:db8::8; skip 10.50.0.0/16 and 999.1.1.1');
assert.deepEqual(values.map(({ value }) => value), ['10.1.1.2', '2001:db8::8', '10.50.0.0/16']);

let calls = 0;
const provider = new DnsPtrEnrichmentProvider({
  resolver: { reverse: async (address) => { calls += 1; return [`host-${address}.example.test`]; } },
});
const manager = new TerminalEnrichmentManager({ providers: [provider] });
const first = await manager.enrich([{ type: 'ip', value: '10.1.1.2' }]);
assert.equal(first[0].providers['dns-ptr'].hostname, 'host-10.1.1.2.example.test');
await manager.enrich([{ type: 'ip', value: '10.1.1.2' }]);
assert.equal(calls, 1, 'successful PTR lookups are cached');

let failedCalls = 0;
const failureManager = new TerminalEnrichmentManager({ providers: [new DnsPtrEnrichmentProvider({ resolver: { reverse: async () => { failedCalls += 1; throw new Error('NXDOMAIN'); } } })] });
const failed = await failureManager.enrich([{ type: 'ip', value: '10.1.1.3' }]);
assert.equal(failed[0].resolved, false);
await failureManager.enrich([{ type: 'ip', value: '10.1.1.3' }]);
assert.equal(failedCalls, 1, 'failed PTR lookups are cached');
console.log('terminal enrichment tests passed');
