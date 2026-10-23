import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LocalPalAudio, safePalId, localReplySpeech, readPalPreferences, palPreferences, replyClips, spokenReplyText } from './local-pal-audio.js';

test('private replies only enter full local playback after explicit selection',()=>{
  const secret='Private config 10.8.0.1 token=private';
  assert.deepEqual(localReplySpeech('summary',secret),{kind:'notice',notice:'ready'});
  assert.deepEqual(localReplySpeech('unknown',secret),{kind:'notice',notice:'ready'});
  assert.deepEqual(localReplySpeech('full',secret),{kind:'answer',text:secret});
  assert.equal(localReplySpeech('off',secret),null);
  assert.equal(localReplySpeech('full','x'.repeat(8001)).kind,'notice');
  assert.equal(safePalId('https://external/avatar.glb'),'john');assert.equal(safePalId('__proto__'),'john');
  assert.equal(safePalId('lobster'),'lobster');
});

test('voice preference restoration preserves quiet mode and rejects malformed or unbounded values',()=>{
  assert.deepEqual(readPalPreferences({getItem:()=>'{invalid'}),{mode:'summary',rate:1,volume:1});
  assert.equal(readPalPreferences({getItem:()=>'{"mode":"off"}'}).mode,'off');
  assert.equal(readPalPreferences({getItem(){throw Error('denied');}}).mode,'summary');
  assert.deepEqual(palPreferences({mode:'external',rate:100,volume:-4}),{mode:'summary',rate:1.25,volume:0});
  assert.equal(palPreferences(null).mode,'summary');
});

test('stop and avatar navigation suppress in-flight speech; no provider requests',async()=>{
  const states=[],requests=[];let resolveFetch,starts=0,stops=0,closed=0;
  const source=()=>({connect(){},disconnect(){},start(){starts++;},stop(){stops++;}});
  const context={resume:async()=>{},close:async()=>{closed++;},destination:{},createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),createBufferSource:source,
    decodeAudioData:async()=>({}),createAnalyser:()=>({fftSize:512,connect(){},disconnect(){},getFloatTimeDomainData(array){array.fill(.05);}})};
  const player=new LocalPalAudio({context:()=>context,onState:state=>states.push(state),fetcher:async(url,options)=>{
    requests.push({url,options});return await new Promise(resolve=>{resolveFetch=resolve;});
  }});
  const response={ok:true,arrayBuffer:async()=>new ArrayBuffer(44)};
  const first=player.play({kind:'notice',notice:'ready'});await new Promise(resolve=>setImmediate(resolve));player.stop();resolveFetch(response);await first;
  assert.equal(starts,0);assert.equal(requests[0].options.signal.aborted,true);
  const second=player.play({kind:'notice',notice:'hello-lobster'});await new Promise(resolve=>setImmediate(resolve));resolveFetch(response);await second;
  assert.equal(starts,1);player.setVolume(.4);assert.equal(player.gain.gain.value,.4);assert.equal(player.level()>.4,true);assert.equal(states.at(-1),'speaking');
  player.dispose();assert.equal(stops,1);assert.equal(closed,1);assert.equal(player.level(),0);
  assert.equal(requests.every(request=>request.url==='/api/pal/local/speech'),true);
});

test('both bundled rigs have required nodes and embedded geometry with no external resources',()=>{
  for(const id of ['john','lobster']){
    const bytes=fs.readFileSync(new URL(`../../public/pal/${id}.glb`,import.meta.url));
    assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
    const document=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const names=new Set(document.nodes.map(node=>node.name));
    for(const required of ['pal_root','pal_head','pal_mouth','pal_eye_left','pal_eye_right'])assert.ok(names.has(required),`${id}: ${required}`);
    assert.ok(document.meshes.length>0);
    assert.equal((document.buffers||[]).some(buffer=>buffer.uri),false);
    assert.equal((document.images||[]).some(image=>image.uri),false);
    assert.equal(bytes.length<5*1024*1024,true);
  }
});

test('audio failures surface and stop prevents even decoding a stale response',async()=>{
  const states=[];let decode=0,resolveFetch;
  const context={state:'suspended',resume:async()=>{},close:async()=>{},decodeAudioData:async()=>{decode++;}};
  const player=new LocalPalAudio({context:()=>context,onState:state=>states.push(state),fetcher:()=>new Promise(resolve=>{resolveFetch=resolve;})});
  await assert.rejects(player.play({kind:'notice',notice:'ready'}),/paused by your browser/);
  assert.equal(states.at(-1),'idle');
  context.state='running';
  const pending=player.play({kind:'notice',notice:'ready'});await new Promise(resolve=>setImmediate(resolve));
  player.dispose();resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(44)});
  assert.equal(await pending,false);assert.equal(decode,0);
});


test('spoken replies remove presentation markup and split on readable boundaries',()=>{
  const text='## Result\n**Healthy** [details](https://example.test/private)\n```sh\nshow secret\n```\nNext step.';
  assert.equal(spokenReplyText(text),'Result Healthy details Code is available in chat. Next step.');
  const long='A sentence worth reading. '.repeat(120), clips=replyClips(long);
  assert.ok(clips.length>1);assert.equal(clips.map(clip=>clip.text).join(' '),long.trim());
  assert.equal(clips.every(clip=>clip.text.length<=1800),true);
  assert.deepEqual(replyClips('x'.repeat(8001)),[]);
  assert.equal(localReplySpeech('summary',long).kind,'notice');
});

test('long replies play sequential clips and Stop cancels the remaining queue',async()=>{
  const requests=[],sources=[],progress=[];
  const context={resume:async()=>{},close:async()=>{},destination:{},createGain:()=>({gain:{value:1},connect(){},disconnect(){}}),decodeAudioData:async()=>({}),
    createBufferSource(){const source={connect(){},disconnect(){},start(){},stop(){}};sources.push(source);return source;},
    createAnalyser:()=>({connect(){},disconnect(){},getFloatTimeDomainData(array){array.fill(0);}})};
  const player=new LocalPalAudio({context:()=>context,onProgress:value=>progress.push(value),fetcher:async(_url,options)=>{
    requests.push(JSON.parse(options.body));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(44)};
  }});
  await player.play([{kind:'answer',text:'One.'},{kind:'answer',text:'Two.'},{kind:'answer',text:'Three.'}]);
  assert.equal(requests.length,1);sources[0].onended();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,2);assert.deepEqual(progress.at(-1),{index:2,total:3});
  const staleEnd=sources[1].onended;player.stop();staleEnd();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,2);assert.deepEqual(progress.at(-1),{index:0,total:0});
});
