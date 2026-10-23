import test from 'node:test';
import assert from 'node:assert/strict';
import { tavusClient, PAL_TOOL, palDefinition } from './pal-provider.js';

test('provider setup uses registered app-message tool; conversation is private, capped and unrecorded',async()=>{
  const calls=[];
  const provider=tavusClient({key:'SECRET',fetchImpl:async(url,options)=>{
    const route=new URL(url).pathname;
    const body=options.body?JSON.parse(options.body):undefined;
    calls.push({url,route,method:options.method,body});
    assert.equal(options.redirect,'error');assert.equal(options.headers['x-api-key'],'SECRET');
    const result=route==='/v2/faces'?{data:[{face_id:'r123',status:'completed',face_name:'Stock'}]}:
      route==='/v2/tools'?{tool_id:'t123'}:route==='/v2/pals'?{pal_id:'p123'}:
      route==='/v2/pals/p123/tools'?{data:[PAL_TOOL]}:route==='/v2/pals/p123'?palDefinition('r123'):
      route==='/v2/conversations/c123'?{status:'ended'}:{};
    return new Response(JSON.stringify(result));
  }});
  assert.deepEqual(await provider.provision('r123'),{palId:'p123',toolId:'t123',faceId:'r123'});
  assert.equal(calls.some(c=>c.route==='/v2/conversations'),false);
  const tool=calls.find(c=>c.route==='/v2/tools').body;
  assert.equal(tool.trigger_type,'in_call');assert.equal(tool.origin,'llm');
  assert.equal(tool.on_resolve,'response_in_result');assert.deepEqual(tool.delivery,{app_message:true});
  await provider.validate('p123','r123');
  await provider.create({palId:'p123',faceId:'r123',name:'bounded',duration:120});
  const conversation=calls.find(c=>c.route==='/v2/conversations').body;
  assert.equal(conversation.require_auth,true);
  assert.deepEqual(conversation.properties,{max_call_duration:120,participant_absent_timeout:30,participant_left_timeout:0,enable_recording:false});
  await provider.end('c123');
  assert.deepEqual(calls.slice(-2).map(c=>[c.method,c.route]),[['POST','/v2/conversations/c123/end'],['GET','/v2/conversations/c123']]);
});
test('provider error bodies and speculative or externally connected PALs fail closed',async()=>{
  const rejecting=tavusClient({key:'SECRET',fetchImpl:async()=>new Response('PRIVATE_PROVIDER_BODY',{status:403})});
  await assert.rejects(()=>rejecting.faces(),error=>!error.message.includes('PRIVATE_PROVIDER_BODY')&&!error.message.includes('SECRET'));
  for(const llm of [{speculative_inference:true},{speculative_inference:false,base_url:'https://other.example'}]){
    const provider=tavusClient({key:'SECRET',fetchImpl:async url=>new Response(JSON.stringify(url.endsWith('/tools')?{data:[PAL_TOOL]}:{pipeline_mode:'full',layers:{llm,perception:{perception_model:'off'}}}))});
    await assert.rejects(()=>provider.validate('p123','r123'),/restricted/);
  }
});
