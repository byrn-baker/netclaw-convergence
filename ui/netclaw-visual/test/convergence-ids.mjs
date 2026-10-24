import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {HomeView} from '../modules/convergence/HomeView.js';

test('sensor strings remain text and quiet VLANs remain unverified', () => {
  const security = {status: 'active', blockedConnections: {lastHour: 0, last24h: 0},
    intrusionDetection: {status: 'active', sensors: [{id: '<img src=x onerror=alert(1)>',
      status: 'active', packets: 12, captureDrops: 0, decoderErrors: 0, pendingEvents: 0,
      coverage: [{vlan: 104, status: 'observed'}, {vlan: 301, status: 'unverified'}]}]}};
  const html = HomeView.prototype.htmlSecurity.call({cache: {security}});
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('img'), null);
  assert.match(document.body.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(document.body.textContent, /301unverified/);
  assert.match(document.body.textContent, /disabled during tuning/);
});

test('firewall outage does not hide independent IDS observations', () => {
  const html = HomeView.prototype.htmlSecurity.call({cache: {security: {
    status: 'unavailable', intrusionDetection: {status: 'active', sensors: []},
  }}});
  const text = new JSDOM(html).window.document.body.textContent;
  assert.match(text, /Firewall telemetry: unavailable/);
  assert.match(text, /Intrusion detection · active/);
  assert.match(text, /Unknown/);
});
