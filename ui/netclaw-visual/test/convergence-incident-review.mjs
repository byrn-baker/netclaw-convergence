import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {assessmentHTML, securityQueueHTML, ispReportsHTML, reportDownload} from '../modules/convergence/IncidentReview.js';
import {HomeView} from '../modules/convergence/HomeView.js';
const doc = html => new JSDOM(html).window.document;
const assessment = {bucket:'diagnostic',label:'Check protocol / capture',reason:'Not a benign verdict <script>bad</script>',next_check:'Check capture',signature:'<img src=x>'};
test('security UI explains priority, filters explicitly and escapes observations', () => {
  const event={id:'case',security_assessment:assessment};
  const d=doc(securityQueueHTML({events:[event]},'diagnostic'));
  assert.equal(d.querySelector('script'),null);assert.equal(d.querySelector('img'),null);
  assert.equal(d.querySelector('[aria-pressed="true"]').dataset.securityFilter,'diagnostic');
  assert.match(d.body.textContent,/not a threat probability/);
  assert.match(d.body.textContent,/applies only to the individual case|apply only to the individual case/);
  assert.ok(d.querySelector('textarea').required);
  assert.equal(doc(securityQueueHTML({events:[event]},'attention')).querySelector('article'),null);
  assert.equal(assessmentHTML({alert_name:'WanHardDown'}),'');
});
const report = {provider:{name:'ISP',support_url:'https://example.test/support',channel:'portal',guidance:'Use portal'},recipient_note:'No inferred email',
  draft:{subject:'Review outage',body:'Please review eligibility.'},evidence_sha256:'abc',evidence:{samples:[{target:'probe-1',success:[[1,0]],duration_ms:[[1,23]]}]}};
test('provider drafts have explicit review controls, no send action, and downloadable email/evidence', () => {
  const d=doc(ispReportsHTML({events:[{id:'case',message:'<img src=x>'}]},{providers:[{id:'isp',name:'ISP'}]},'isp',new Map([['home:case',report]]),new Set(),new Map(),'home'));
  assert.equal(d.querySelector('img'),null);assert.equal(d.querySelector('[data-isp-generate]').disabled,false);
  assert.equal(d.querySelectorAll('[data-isp-download]').length,3);assert.match(d.body.textContent,/nothing has been sent/);
  const mail=reportDownload(report,'email');assert.match(mail.text,/X-Unsent: 1\r\nTo:\r\nSubject:/);assert.equal(mail.extension,'eml');
  const csv=reportDownload(report,'csv');assert.match(csv.text,/probe-1,1970-01-01T00:00:01.000Z,success,0/);
  assert.equal(JSON.parse(reportDownload(report,'evidence').text).sha256,'abc');
});
test('a completed action cannot populate another site and original case content is retained', async () => {
  const event={id:'case',message:'original'};
  const context={site:'home',cache:{securityCases:{events:[event]}},incidentPending:new Set(),incidentErrors:new Map(),securityDrafts:new Map(),ispProviders:new Map([['home','xfinity']]),ispReports:new Map(),renderSubview(){},
    fetch:async()=>({id:'case',security_assessment:assessment})};
  await HomeView.prototype.handleIncidentAction.call(context,'security','case',{kind:'needs_review',reason:'Check endpoint'});
  assert.equal(event.message,'original');assert.equal(event.security_assessment,assessment);
  context.fetch=async()=>{context.site='other';return report;};
  await HomeView.prototype.handleIncidentAction.call(context,'isp','case');
  assert.equal(context.ispReports.size,0);assert.equal(context.incidentPending.size,0);
});
