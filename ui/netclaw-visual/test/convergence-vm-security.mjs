import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {HomeView} from '../modules/convergence/HomeView.js';
import {vmSecurityHTML,vmSecurityModel} from '../modules/convergence/VMSecurity.js';
const now=Math.floor(Date.now()/1000);
const source={id:'observer',site:'home',node:'node-1',status:'reporting',observed_at:now,last_contact:now,coverage:{fresh:true,inventory_ok:true,packet_capture_ok:true},vms:Array.from({length:54},(_,i)=>({vm_id:i+100,vm_uuid:`uuid-${i}`,power_state:'running',capture_state:i === 0 ? 'unknown' : 'observing',nics:[]})),findings:[{kind:'port_scan',vm_id:100,vm_uuid:'uuid-0',reason:'Many distinct ports',first_seen:now,last_seen:now,evidence:{unique_tcp_five_tuples:24,unique_destination_ports:24,unique_destination_ips:1,destination_ip:'198.51.100.4',examples:[{src_ip:'10.0.0.1',dst_ip:'198.51.100.4',protocol:'TCP',dst_port:22}]}},{kind:'network_sweep',vm_id:102,vm_uuid:'uuid-2',evidence:{unique_destination_ips:20}}]};
const data=()=>({site:'home',summary:{assessment:'review'},sources:[structuredClone(source)]});
const doc=html=>new JSDOM(html).window.document;
test('queue prioritizes advisory evidence; 54 VMs are paginated and diagnostics collapsed',()=>{
  const d=doc(vmSecurityHTML(data(),{site:'home'}));
  assert.equal(d.querySelectorAll('.vm-metric').length,4);
  assert.equal(d.querySelectorAll('[data-vm-finding]').length,2);
  assert.equal(d.querySelectorAll('.vm-row').length,10);
  assert.match(d.querySelector('.vm-detail').textContent,/24/);
  assert.match(d.querySelector('.vm-detail').textContent,/Many distinct ports/);
  assert.equal(d.querySelectorAll('.vm-security details[open]').length,0);
  assert.equal(d.querySelectorAll('.vm-list table').length,0);
  assert.match(d.body.textContent,/not confirmed attacks/);
});
test('finder search, filters and pagination intersect without mutating data',()=>{
  const input=data();
  assert.equal(vmSecurityModel(input,{search:'uuid-53'}).rows[0].vm_id,153);
  assert.deepEqual(vmSecurityModel(input,{filter:'review'}).rows.map(v=>v.vm_id),[100,102]);
  assert.equal(vmSecurityModel(input,{filter:'visibility'}).rows.length,1);
  assert.equal(vmSecurityModel(input,{page:5}).rows.length,4);
  assert.equal(vmSecurityModel(input,{page:999}).page,5);
  assert.equal(input.sources[0].vms.length,54);
});
test('stopped VMs remain searchable inventory without creating coverage gaps or monitored counts',()=>{
  const value=data();value.sources[0].vms=[
    {vm_id:100,power_state:'stopped',capture_state:'stopped'},
    {vm_id:101,vm_uuid:'uuid-101',power_state:'running',capture_state:'observing'},
    {vm_id:102,power_state:'running',capture_state:'unavailable'},
    {vm_id:103,power_state:'unknown',capture_state:'unavailable'},
  ];value.sources[0].findings=[];
  const m=vmSecurityModel(value);assert.deepEqual(m.vms.filter(v=>v.monitored).map(v=>v.vm_id),[101]);
  assert.deepEqual(vmSecurityModel(value,{filter:'visibility'}).rows.map(v=>v.vm_id),[102,103]);
  assert.equal(vmSecurityModel(value,{search:'100'}).rows[0].vm_id,100);
  const d=doc(vmSecurityHTML(value));assert.equal(d.querySelector('.vm-row .home-badge').textContent,'Stopped');
  assert.equal(d.querySelectorAll('.vm-metric')[2].querySelector('strong').textContent,'2');
  assert.equal(d.querySelectorAll('.vm-metric')[3].querySelector('strong').textContent,'1');
  value.sources[0].status='stale';assert.equal(vmSecurityModel(value,{filter:'visibility'}).rows.length,3);
  assert.equal(vmSecurityModel(value,{error:'offline'}).vms[0].visibilityGap,false);
});
test('missing, cross-site, stale and empty observations never imply safety',()=>{
  for(const value of [undefined,{}, {unavailable:true,sources:[]},{...data(),site:'other'}]){
    const d=doc(vmSecurityHTML(value,{site:'home'}));assert.match(d.body.textContent,/visibility is unknown/);assert.equal(d.querySelector('.vm-summary'),null);
  }
  const empty=data();empty.sources[0].findings=[];empty.sources[0].vms[0].capture_state='observing';empty.summary.assessment='no_patterns_observed';
  assert.match(doc(vmSecurityHTML(empty)).body.textContent,/No suspicious patterns observed/);
  assert.match(doc(vmSecurityHTML(empty)).body.textContent,/not an all clear/);
  empty.sources[0].status='stale';
  const stale=doc(vmSecurityHTML(empty,{error:'offline'}));assert.match(stale.body.textContent,/Stale or incomplete coverage/);assert.match(stale.body.textContent,/Refresh failed/);assert.match(stale.querySelector('.vm-empty').textContent,/Insufficient evidence/);assert.doesNotMatch(stale.querySelector('.vm-empty').textContent,/No suspicious patterns observed/);
  assert.equal(vmSecurityModel(empty).vms.filter(v=>!v.visibilityGap).length,0);
});
test('source summary counts and VM finding counts survive truncated findings, and stale cached monitoring is unknown',()=>{
  const value=data();value.sources[0].summary={finding_count:120,affected_vm_count:40,findings_truncated:true,assessment:'review'};
  value.sources[0].vms[53].finding_count=1;
  const d=doc(vmSecurityHTML(value));assert.match(d.querySelectorAll('.vm-metric')[0].textContent,/40/);assert.match(d.querySelectorAll('.vm-metric')[1].textContent,/120/);assert.match(d.body.textContent,/bounded findings queue/);
  assert.equal(vmSecurityModel(value,{filter:'review'}).filtered.length,3);
  const cached=doc(vmSecurityHTML(value,{error:'offline'}));assert.equal(cached.querySelectorAll('.vm-metric')[3].querySelector('strong').textContent,'0');assert.match(cached.querySelector('.vm-detail').textContent,/visibility unknown/);
  value.sources[0].site='other';assert.equal(vmSecurityModel(value,{site:'home'}).valid,false);
});
test('all API fields are escaped including attribute values and connection evidence',()=>{
  const value=data(),bad='<img src=x onerror="bad()"><script>bad()</script>';
  Object.assign(value.sources[0],{id:bad,node:bad,summary:{finding_count:bad,affected_vm_count:bad}});Object.assign(value.sources[0].findings[0],{kind:bad,reason:bad,caveat:bad,vm_uuid:bad});
  value.sources[0].findings[0].evidence.examples[0].dst_ip=bad;value.sources[0].vms[0].vm_uuid=bad;
  const d=doc(vmSecurityHTML(value,{search:'" onfocus="bad()'}));
  assert.equal(d.querySelector('img,script,[onfocus],[onerror]'),null);assert.ok(d.body.textContent.includes(bad));
});
function mounted(){
  const dom=new JSDOM('<div id="root"></div>');const root=dom.window.document.querySelector('#root');
  const view=new HomeView(root,{embedded:true});view.element=root;view.subview='vm-security';view.site='home';view.cache={vmSecurity:data()};view.renderSiteSelector=()=>{};view.refresh=()=>{};
  root.innerHTML=view.templateToolbar()+view.templateShell();view.bind();view.renderSubview();return {view,dom,root};
}
test('real delegated controls select findings, search, filter, paginate and expose dedicated navigation',()=>{
  const {view,dom,root}=mounted();
  assert.equal(root.querySelector('[data-home-sub="vm-security"]').textContent,'VM Security');
  root.querySelector('[data-vm-finding="observer:1"]').click();assert.equal(root.querySelector('[data-vm-finding-detail]').dataset.vmFindingDetail,'observer:1');
  root.querySelector('[data-vm-page="1"]').click();assert.equal(view.vmSecurityPage,1);assert.match(root.querySelector('.vm-row summary').textContent,/110/);
  const search=root.querySelector('[data-vm-search]');search.value='uuid-53';search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.equal(root.querySelectorAll('.vm-row').length,1);assert.match(root.querySelector('.vm-row').textContent,/153/);assert.equal(view.vmSecurityPage,0);
  const filter=root.querySelector('[data-vm-filter]');filter.value='review';filter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(root.querySelectorAll('.vm-row').length,0);dom.window.close();
});
function refreshContext(fetch){return {site:'home',subview:'vm-security',cache:{},readTimes:{},options:{embedded:true},renderSubview(){},discoverSites:async()=>{},syncTopbarMetrics(){},fetch};}
test('dedicated endpoint loads despite unrelated health failure and retains failed-refresh evidence honestly',async()=>{
  let fail=false;const calls=[];const context=refreshContext(async path=>{calls.push(path);if(path==='/status')return {configured:true};if(path.startsWith('/security/vms?')){if(fail)throw Error('offline');return data();}throw Error('health unavailable');});
  await HomeView.prototype.refresh.call(context);assert.equal(context.cache.vmSecurity.site,'home');assert.ok(calls.includes('/security/vms?site=home'));assert.equal(calls.some(p=>p.startsWith('/security?')),false);
  fail=true;await HomeView.prototype.refresh.call(context);assert.equal(context.sourceErrors['vm-security'],'offline');assert.equal(context.cache.vmSecurity.site,'home');
});
test('a failed status read marks retained VM findings historical and stops claiming current monitoring',async()=>{
  let failStatus=false;
  const context=refreshContext(async path=>{
    if(path === '/status'){if(failStatus)throw Error('Status offline');return {configured:true};}
    return path.startsWith('/security/vms?') ? data() : {};
  });
  await HomeView.prototype.refresh.call(context);assert.equal(context.cache.vmSecurity.sources[0].status,'reporting');
  failStatus=true;await HomeView.prototype.refresh.call(context);
  assert.equal(context.lastError.kind,'config');
  const d=doc(HomeView.prototype.htmlBodyForSubview.call(context));
  assert.match(d.body.textContent,/Refresh failed/);assert.match(d.querySelector('.vm-detail').textContent,/Historical advisory/);
  assert.equal(d.querySelectorAll('.vm-metric')[3].querySelector('strong').textContent,'0');
});
test('actual API unavailable response and status-only fallback never show zeros or a successful read',async()=>{
  for(const unavailable of [{status:'unavailable',unavailable:true,sources:[],reason:'Receiver offline'},{status:'unavailable',sources:[],reason:'Receiver offline'}]) {
    const d=doc(vmSecurityHTML(unavailable,{site:'home'}));
    assert.match(d.body.textContent,/observations unavailable/);assert.equal(d.querySelector('.vm-summary'),null);assert.doesNotMatch(d.body.textContent,/No observers configured/);
    const context=refreshContext(async path=>path === '/status' ? {configured:true} : path.startsWith('/security/vms?') ? unavailable : {});
    await HomeView.prototype.refresh.call(context);
    assert.equal(context.sourceErrors['vm-security'],'Receiver offline');assert.equal(context.readTimes.vmSecurity,undefined);
  }
});
test('site changes while endpoint is pending cannot install previous-site VM observations',async()=>{
  let finish,start;const started=new Promise(r=>start=r);const context=refreshContext(async path=>{if(path==='/status')return {configured:true};if(path.startsWith('/security/vms?')){start();return new Promise(r=>finish=r);}return {};});
  const pending=HomeView.prototype.refresh.call(context);await started;context.site='other';context.cache={};finish(data());await pending;assert.equal(context.cache.vmSecurity,undefined);
});

const metric = (document,label) => [...document.querySelectorAll('.vm-metric')].find(element=>element.querySelector('span').textContent === label).querySelector('strong').textContent;
test('missing UUID and failed inventory or capture are visibility gaps in metrics and filter',()=>{
  for(const failure of ['uuid','inventory_ok','packet_capture_ok']) {
    const value=data();value.sources[0].findings=[];
    value.sources[0].vms=[
      {vm_id:100,vm_uuid:'uuid-100',power_state:'running',capture_state:'observing'},
      {vm_id:101,vm_uuid:null,power_state:'stopped',capture_state:'stopped'},
    ];
    if(failure === 'uuid') value.sources[0].vms[0].vm_uuid=null;
    else value.sources[0].coverage[failure]=false;
    const d=doc(vmSecurityHTML(value));
    assert.equal(metric(d,'Monitored VMs'),'0',failure);
    assert.equal(metric(d,'Visibility gaps'),'1',failure);
    assert.match(d.querySelector('.vm-empty').textContent,/Insufficient evidence/,failure);
    assert.deepEqual(vmSecurityModel(value,{filter:'visibility'}).rows.map(vm=>vm.vm_id),[100],failure);
    const filtered=doc(vmSecurityHTML(value,{filter:'visibility'}));
    assert.equal(filtered.querySelectorAll('.vm-row').length,1,failure);
    assert.match(filtered.querySelector('.vm-row summary').textContent,/VM 100.*Visibility gap/,failure);
    assert.equal(d.querySelectorAll('.vm-row .home-badge')[1].textContent,'Stopped',failure);
  }
});
test('unknown power and missing coverage flags cannot claim current monitoring',()=>{
  const value=data();value.sources[0].findings=[];
  value.sources[0].vms=[{vm_id:100,vm_uuid:'uuid-100',power_state:'unknown',capture_state:'observing'}];
  let d=doc(vmSecurityHTML(value));
  assert.equal(metric(d,'Monitored VMs'),'0');assert.equal(metric(d,'Visibility gaps'),'1');
  assert.equal(vmSecurityModel(value,{filter:'visibility'}).rows.length,1);
  value.sources[0].vms[0].power_state='running';
  for(const field of ['fresh','inventory_ok','packet_capture_ok']) {
    const missing=structuredClone(value);delete missing.sources[0].coverage[field];
    d=doc(vmSecurityHTML(missing));assert.equal(metric(d,'Monitored VMs'),'0',field);assert.equal(metric(d,'Visibility gaps'),'1',field);
  }
});
test('failed current capture labels retained findings historical and empty stale samples insufficient',()=>{
  for(const field of ['inventory_ok','packet_capture_ok']) {
    const value=data();value.sources[0].coverage[field]=false;
    const d=doc(vmSecurityHTML(value));assert.match(d.querySelector('.vm-detail .home-badge').textContent,/Historical advisory/);
  }
  const value=data();value.sources[0].findings=[];value.sources[0].vms.forEach(vm=>vm.capture_state='observing');
  for(const state of [{error:'offline'},{}]) {
    value.sources[0].status=state.error ? 'reporting' : 'stale';
    const d=doc(vmSecurityHTML(value,state));assert.match(d.querySelector('.vm-empty').textContent,/Insufficient evidence/);
  }
});
test('cached evidence ages into a visibility gap on rerender and either source timestamp controls freshness',t=>{
  t.mock.method(Date,'now',()=>now*1000);
  const value=data();value.sources[0].vms[0].capture_state='observing';
  let d=doc(vmSecurityHTML(value));assert.equal(metric(d,'Monitored VMs'),'54');
  assert.equal(d.querySelector('.vm-detail .home-badge').textContent,'Advisory · needs review');
  t.mock.method(Date,'now',()=>(now+61)*1000);
  d=doc(vmSecurityHTML(value,{filter:'visibility'}));assert.equal(metric(d,'Monitored VMs'),'0');
  assert.equal(metric(d,'Visibility gaps'),'54');assert.match(d.querySelector('.vm-detail .home-badge').textContent,/Historical advisory/);
  assert.equal(vmSecurityModel(value,{filter:'visibility'}).filtered.length,54);
  t.mock.method(Date,'now',()=>now*1000);
  for(const field of ['observed_at','last_contact']) {
    const stale=structuredClone(value);stale.sources[0][field]=now-61;
    assert.equal(metric(doc(vmSecurityHTML(stale)),'Monitored VMs'),'0',field);
  }
  const oldFinding=structuredClone(value);oldFinding.sources[0].findings[0].last_seen=now-61;
  d=doc(vmSecurityHTML(oldFinding));assert.equal(metric(d,'Monitored VMs'),'54');
  assert.match(d.querySelector('.vm-detail .home-badge').textContent,/Historical advisory/);
});

test('findings with an old UUID do not mark a reused VM ID as needing review',()=>{
  const value=data();value.sources[0].vms[0].vm_uuid='replacement-uuid';
  assert.deepEqual(vmSecurityModel(value,{filter:'review'}).rows.map(vm=>vm.vm_id),[102]);
  const d=doc(vmSecurityHTML(value));assert.match(d.querySelector('.vm-detail .home-badge').textContent,/Historical advisory/);
});
