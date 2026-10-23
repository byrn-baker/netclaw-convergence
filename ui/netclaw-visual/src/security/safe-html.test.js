import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { setSafeHtml, appendSafeHtml } from './safe-html.js';

const payloads = [
  '<img src=x onerror="window.pwned=true">',
  '<svg><a onmouseover="window.pwned=true">peer</a></svg>',
  '<math><mtext><img src=x onerror="window.pwned=true"></mtext></math>',
  '<script>window.pwned=true</script><iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<input value="title" onfocus="window.pwned=true" autofocus><a href="javascript:alert(1)">bad</a>',
  '<form action="/api/env"><input type="image" src="https://example.invalid/track"></form>',
  '<style>@import "https://example.invalid/track";</style><link rel="stylesheet" href="https://example.invalid/track">',
];
for (const payload of payloads) {
  test(`untrusted markup cannot introduce active content: ${payload.slice(0, 35)}`, () => {
    const dom = new JSDOM('<div id="target"></div>');
    const target = dom.window.document.querySelector('#target');
    setSafeHtml(target, payload);
    appendSafeHtml(target, payload);
    assert.equal(target.querySelector('script,iframe,img,svg,math,style,link,form'), null);
    for (const element of target.querySelectorAll('*')) {
      for (const attr of element.attributes) {
        assert.ok(!/^on/i.test(attr.name), attr.name);
        assert.ok(!/^(?:src|srcdoc|srcset|action|formaction|autofocus)$/i.test(attr.name), attr.name);
        assert.ok(!/^\s*javascript:/i.test(attr.value), attr.value);
      }
    }
    dom.window.close();
  });
}

test('safe formatting, controls, attributes and inline presentation survive', () => {
  const dom = new JSDOM('<div></div>');
  const target = dom.window.document.querySelector('div');
  setSafeHtml(target, '<h3>Peer</h3><table><tbody><tr><td>healthy</td></tr></tbody></table><input id="config" data-key="TOKEN" value="fixture"><button id="save" type="button">Save</button><pre style="color:#65c3ff;white-space:pre-wrap;background-image:url(https://example.invalid/track);position:fixed">show route</pre>');
  assert.equal(target.querySelector('#config').value, 'fixture');
  assert.equal(target.querySelector('#config').dataset.key, 'TOKEN');
  assert.equal(target.querySelector('td').textContent, 'healthy');
  assert.equal(target.querySelector('pre').style.whiteSpace, 'pre-wrap');
  assert.equal(target.querySelector('pre').style.backgroundImage, '');
  assert.equal(target.querySelector('pre').style.position, '');
  let clicks = 0;
  target.querySelector('#save').addEventListener('click', () => clicks++);
  appendSafeHtml(target, '<p>next message</p>');
  target.querySelector('#save').click();
  assert.equal(clicks, 1, 'append preserves existing listeners');
  dom.window.close();
});

test('main and data panels cannot bypass the HTML insertion boundary', () => {
  for (const relative of ['../main.js', '../panels/KnowledgePanel.js', '../panels/TwitterPanel.js']) {
    const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.innerHTML\s*(?:\+?=)|insertAdjacentHTML\s*\(/, relative);
    assert.match(source, /setSafeHtml/);
  }
});
