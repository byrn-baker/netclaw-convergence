import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {hostHeartbeatHTML} from '../modules/convergence/HostHeartbeat.js';
import {HomeView} from '../modules/convergence/HomeView.js';
const agent = {id:'enrollment-example',vm_id:'vm-example',status:'reporting',reason:'heartbeat_received',heartbeat_observed:1800000000,last_contact:1800000030,
  heartbeat:{collection_ok:true,queue_events:0,queue_bytes:0,dropped_events:2},pending_events:1,pending_limit:64,valid_until:'2028-01-01T00:00:00Z',evidence_trust:'guest_reported'};
const doc = html => new JSDOM(html).window.document;

test('VM heartbeat card is outside sensor details in both actual Security view modes, independent of cases and IDS',()=>{
  for (const embedded of [false,true]) {
    const context={cache:{security:{status:'unavailable',intrusionDetection:{status:'unavailable'},hostTelemetry:{status:'configured',agents:[agent]}},securityCases:{unavailable:true}},options:{embedded},securityState:()=>({}),securityDrafts:new Map(),incidentPending:new Set(),incidentErrors:new Map()};
    const d=doc(HomeView.prototype.htmlSecurity.call(context));
    const card=d.querySelector('[aria-labelledby="host-heartbeat-title"]');
    assert.ok(card);assert.equal(card.closest('details'),null);
    assert.match(card.textContent,/vm-example/);assert.match(card.textContent,/Reporting/);
    assert.match(card.textContent,/guest_reported/);assert.match(card.textContent,/not proof of compromise/);
    assert.equal(card.querySelectorAll('th[scope="col"]').length,8);
    const text=card.textContent;
    assert.match(text,/2027-01-15T08:00:00.000Z/);assert.match(text,/2027-01-15T08:00:30.000Z/);
    assert.match(text,/Events: 0/);assert.match(text,/Dropped: 2/);assert.match(text,/2028-01-01/);
  }
});
test('states, unknown observations and missing counters remain distinct from zero or success',()=>{
  for (const [status,label] of [['unknown','Unknown'],['stale','Stale · visibility lost'],['degraded','Degraded'],['inactive','Inactive / expired'],['revoked','Revoked']]) {
    const d=doc(hostHeartbeatHTML({status:'configured',agents:[{...agent,status,heartbeat:null,heartbeat_observed:null,last_contact:null,pending_events:null}]}));
    assert.match(d.body.textContent,new RegExp(label));
    assert.match(d.body.textContent,/Events: Unknown/);assert.match(d.body.textContent,/Dropped: Unknown/);
    assert.match(d.body.textContent,/Age unknown/);assert.doesNotMatch(d.body.textContent,/Reporting OK/);
  }
  const d=doc(hostHeartbeatHTML({status:'configured',agents:[agent]},1800000060000));
  assert.match(d.body.textContent,/60s ago/);
});
test('empty and unavailable states are explicit, and hostile VM/reason strings are escaped',()=>{
  for (const data of [{status:'not_configured',agents:[]},{status:'configured',agents:[]}]) assert.match(doc(hostHeartbeatHTML(data)).body.textContent,/No VM heartbeat enrollments/);
  for (const data of [undefined,{}, {status:'unavailable',agents:[]}]) assert.match(doc(hostHeartbeatHTML(data)).body.textContent,/status unavailable/);
  const hostile='<img src=x onerror="bad()"><script>bad()</script>';
  for (const data of [{status:'configured',agents:[{...agent,vm_id:hostile,id:hostile,reason:hostile}]},{status:'unavailable',reason:hostile}]) {
    const d=doc(hostHeartbeatHTML(data));assert.equal(d.querySelector('img,script'),null);assert.ok(d.body.textContent.includes(hostile));
  }
});
test('refresh fetches only existing security route despite health/case failures and replaces previous reporting on read failure',async()=>{
  let fail=false;const calls=[];
  const context={site:'example',subview:'security',cache:{},readTimes:{},options:{embedded:true},renderSubview(){},discoverSites:async()=>{},syncTopbarMetrics(){},fetch:async path=>{
    calls.push(path);if(path==='/status')return {configured:true};
    if(path.startsWith('/security?')) {if(fail)throw Error('offline');return {hostTelemetry:{status:'configured',agents:[agent]}};}
    throw Error('unavailable');
  }};
  await HomeView.prototype.refresh.call(context);
  assert.equal(context.cache.security.hostTelemetry.agents[0].status,'reporting');
  fail=true;await HomeView.prototype.refresh.call(context);
  assert.equal(context.cache.security.hostTelemetry.status,'unavailable');
  assert.ok(calls.includes('/security?site=example'));assert.equal(calls.some(p=>/host-events|host-status/.test(p)),false);
});

test('forced Security refresh replaces cached reporting before an unrelated devices failure',async()=>{
  for (const failSecurity of [false,true]) {
    const calls=[];
    const context={site:'example',subview:'security',cache:{security:{hostTelemetry:{status:'configured',agents:[agent]}}},readTimes:{},options:{embedded:true},renderSubview(){},discoverSites:async()=>{},syncTopbarMetrics(){},fetch:async path=>{
      calls.push(path);
      if(path==='/status')return {configured:true};
      if(path.startsWith('/security?')) {
        if(failSecurity)throw Error('Security offline');
        return {hostTelemetry:{status:'configured',agents:[{...agent,status:'stale'}]}};
      }
      if(path.startsWith('/devices?'))throw Error('Devices offline');
      return {};
    }};
    await HomeView.prototype.refresh.call(context,true);
    assert.ok(calls.indexOf('/security?site=example')<calls.indexOf('/devices?site=example'));
    assert.equal(context.lastError.message,'Devices offline');
    assert.equal(context.cache.security.hostTelemetry.status,failSecurity?'unavailable':'configured');
    if(!failSecurity)assert.equal(context.cache.security.hostTelemetry.agents[0].status,'stale');
  }
});
test('a delayed Security read cannot populate the newly selected site',async()=>{
  let finish,started;
  const waiting=new Promise(resolve=>{started=resolve;});
  const current={hostTelemetry:{status:'not_configured',agents:[]}};
  const context={site:'previous-site',subview:'security',cache:{},readTimes:{},options:{embedded:true},securityState:()=>({}),renderSubview(){},discoverSites:async()=>{},syncTopbarMetrics(){},fetch:async path=>{
    if(path==='/status')return {configured:true};
    if(path==='/security?site=previous-site'){
      started();return new Promise(resolve=>{finish=resolve;});
    }
    return {};
  }};
  const refresh=HomeView.prototype.refresh.call(context,true);
  await waiting;
  context.site='new-site';context.cache={security:current};
  finish({hostTelemetry:{status:'configured',agents:[agent]}});
  await refresh;
  assert.equal(context.cache.security,current);
  assert.doesNotMatch(HomeView.prototype.htmlSecurity.call(context),/vm-example/);
});
