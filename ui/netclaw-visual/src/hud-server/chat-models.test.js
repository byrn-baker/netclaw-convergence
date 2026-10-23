import test from 'node:test';
import assert from 'node:assert/strict';
import { publicChatModels, resolveChatModel } from './chat-models.js';

const config = { agents: { defaults: {
  model: { primary: 'provider/fast@private-profile', fallbacks: ['provider/large'] },
  models: { 'provider/fast@private-profile': {}, 'provider/large': {} },
}, entries: { engineer: {} } } };
test('catalog exposes configured choices without authentication profile references', () => {
  const catalog = publicChatModels(config);
  assert.equal(catalog.defaultModel, 'provider/fast');
  assert.equal(catalog.models.length, 2);
  assert.doesNotMatch(JSON.stringify(catalog), /private-profile/);
  assert.equal(resolveChatModel(config, catalog.models[0].id), 'provider/fast@private-profile');
  assert.equal(resolveChatModel(config, ''), 'provider/fast@private-profile');
  assert.equal(resolveChatModel(config, undefined), undefined);
});
test('rejects arbitrary models, header injection, stale selections and invalid types', () => {
  for (const selection of ['provider/other', 'x\r\ny', {}, null, 7]) {
    assert.throws(() => resolveChatModel(config, selection));
  }
  const choice = publicChatModels(config).models[1].id;
  assert.throws(() => resolveChatModel({ agents: { defaults: { model: 'provider/fast' } } }, choice));
});
test('selected agent model overrides the global default without mutating config', () => {
  const custom = structuredClone(config);
  custom.agents.entries.engineer.model = 'provider/special';
  const before = JSON.stringify(custom);
  assert.equal(publicChatModels(custom).defaultModel, 'provider/special');
  assert.equal(resolveChatModel(custom, ''), 'provider/special');
  assert.equal(JSON.stringify(custom), before);
});

test('same backend model is shown once and retains the primary authentication profile', () => {
  const custom = structuredClone(config);
  custom.agents.defaults.models['provider/fast'] = {};
  const catalog = publicChatModels(custom);
  assert.equal(catalog.models.filter(m => m.label === 'provider/fast').length, 1);
  assert.equal(resolveChatModel(custom, catalog.models.find(m => m.label === 'provider/fast').id), 'provider/fast@private-profile');
});
