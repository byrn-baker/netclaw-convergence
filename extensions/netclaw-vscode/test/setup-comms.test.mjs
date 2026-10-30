import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {load} from './load.mjs';
const {validateComms,discoverComms,selectChannels,channelFields,setZoomBinding,channelTestChoices,setChannelTests,commsReportSummary}=await load('src/setup/comms.ts');
const read=name=>JSON.parse(fs.readFileSync('../../config/components/'+name));
const manifest=read('comms.json'),schema=read('comms.schema.json'),catalog=read('catalog.json');
const claw=()=>({id:'test-claw',harness:'hermes',runtimeVersion:'0.21.6',role:'focused',channels:[],
  capabilities:{components:[]},provider:{id:'anthropic'},settings:{ANTHROPIC_API_KEY:{kind:'secret',key:'ANTHROPIC_API_KEY',owner:'test-claw',source:'later'}}});
test('report summary keeps configuration, connection, submission and delivery distinct',()=>{
  const summary=commsReportSummary({installations:[{comms:[{configuration:{state:'verified',code:'configuration_valid'},
    authentication:{state:'unverified'},transport:{state:'unverified'},
    outbound:{state:'verified',code:'submission_accepted'},raw:'private-token'}]}]});
  assert.match(summary,/1 configured; 0 authenticated; 0 connected/);
  assert.match(summary,/1 outbound submitted; 0 delivery confirmed/);
  assert.doesNotMatch(summary,/private-token/);
  assert.equal(commsReportSummary({installations:[]}),undefined);
});
test('message-test choices materialize owner/channel/direction without losing imported requests',()=>{
  const selected={...claw(),displayName:'Fixture',channels:[{id:'slack'},{id:'discord'}]};
  const legacy={owner:selected.id,channel:'slack',destinationRef:'retained-destination'};
  const inbound={owner:selected.id,channel:'slack',direction:'inbound',destinationRef:'retained-inbound'};
  const plan={claws:[selected],verification:{channelTests:[legacy,inbound]}};
  const choices=channelTestChoices(plan,manifest);
  assert.deepEqual(choices.map(c=>c.key),['test-claw/slack/outbound','test-claw/discord/outbound']);
  const changed=setChannelTests(plan,choices.map(c=>c.key),manifest);
  assert.deepEqual(changed.verification.channelTests,[legacy,inbound,{owner:selected.id,channel:'discord',direction:'outbound',destinationRef:'native-test'}]);
  assert.deepEqual(plan.verification.channelTests,[legacy,inbound]);
  assert.deepEqual(setChannelTests(plan,[],manifest).verification.channelTests,[inbound]);
  assert.throws(()=>setChannelTests(plan,['test-claw/slack/inbound'],manifest));
});
test('Zoom binding drafts only an explicit same-plan owner and unique loopback port',()=>{
  const plan={shape:'risk',claws:[{...claw(),id:'border',role:'border',endpoints:{hudPort:19001}},
    {...claw(),role:'member',capabilities:{components:['zoom-rtms']},endpoints:{hudPort:19002}}]};
  const bound=setZoomBinding(plan,'test-claw',19876);
  assert.deepEqual(bound.commsBindings,[{id:'test-claw',integration:'zoom',owner:'test-claw',border:'border',port:19876}]);
  assert.equal(plan.commsBindings,undefined);
  assert.deepEqual(setZoomBinding(bound,'test-claw',null).commsBindings,[]);
  for(const port of [19001,19002,0,65536,1.5])assert.throws(()=>setZoomBinding(plan,'test-claw',port));
  assert.throws(()=>setZoomBinding(plan,'border',19876));
  assert.throws(()=>setZoomBinding({...plan,shape:'focused'},'test-claw',19876));
  const other={...claw(),id:'other',role:'member',capabilities:{components:['zoom-rtms']}};
  assert.throws(()=>setZoomBinding({...bound,claws:[...bound.claws,other]},'other',19877));
});
test('complete discovery preserves runtime names, kinds, role and pin dispositions',()=>{
  validateComms(manifest,schema);
  assert.equal(discoverComms(manifest).length,77);
  for(const harness of ['openclaw','hermes']){
    assert.ok(discoverComms(manifest,'twilio',harness).some(e=>e.channelId==='sms'));
    assert.ok(discoverComms(manifest,'twilio',harness).some(e=>e.component==='twilio'));
    assert.ok(discoverComms(manifest,'zoom',harness).some(e=>e.component==='zoom-rtms'));
  }
  assert.equal(discoverComms(manifest,'google','hermes')[0].nativeId,'google_chat');
  const home=discoverComms(manifest,'homeassistant','hermes',{...claw(),role:'border'},'macos')[0];
  assert.equal(home.state,'role-restricted');
  assert.equal(discoverComms(manifest,'','openclaw').find(e=>e.channelId==='x').state,'unavailable-baseline');
  const tools=discoverComms(manifest,'twilio','hermes',claw(),'macos');
  assert.equal(tools.find(e=>e.channelId==='twilio-core').selectable,true);
  assert.equal(tools.find(e=>e.channelId==='twilio-voice').selectable,false);
});
test('strict manifests reject duplicate IDs and private URL authority',()=>{
  const duplicated=structuredClone(manifest);duplicated.entries.push(duplicated.entries[0]);
  assert.throws(()=>validateComms(duplicated,schema));
  const bad=structuredClone(manifest);bad.entries[0].documentation='https://user:secret@example.com';
  assert.throws(()=>validateComms(bad,schema));
});
test('multi-selection retains settings and explicit None preserves provider references',()=>{
  const original=claw(),two=selectChannels(original,['slack','discord'],catalog,manifest);
  assert.deepEqual(two.channels.map(c=>c.id),['slack','discord']);
  two.settings.DISCORD_BOT_TOKEN.source='later';
  const one=selectChannels(two,['discord'],catalog,manifest);
  assert.equal(one.settings.DISCORD_BOT_TOKEN.source,'later');
  assert.equal(one.settings.SLACK_BOT_TOKEN,undefined);
  assert.deepEqual(one.settings.ANTHROPIC_API_KEY,original.settings.ANTHROPIC_API_KEY);
  assert.deepEqual(original.channels,[]);
  assert.deepEqual(selectChannels(one,['none'],catalog,manifest).channels,[]);
  assert.throws(()=>selectChannels(one,['none','discord'],catalog,manifest));
  assert.throws(()=>selectChannels({...original,role:'member'},['discord'],catalog,manifest));
  assert.throws(()=>channelFields({...original,harness:'hermes'},'webex',catalog,manifest));
});
