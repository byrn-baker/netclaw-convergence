import test from 'node:test';
import assert from 'node:assert/strict';
import {mouthEnvelope,replyNod,avatarKeyAction} from './pal-motion.js';

test('speech motion follows real amplitude consistently across frame rates and settles closed',()=>{
  const integrate=hz=>{let level=0;for(let i=0;i<hz;i++)level=mouthEnvelope(level,.6,1/hz);return level;};
  assert.ok(Math.abs(integrate(30)-integrate(120))<.00001);
  let level=integrate(60);assert.ok(level>.5&&level<.6);
  for(let i=0;i<120;i++)level=mouthEnvelope(level,0,1/60);
  assert.equal(level,0);assert.equal(mouthEnvelope(0,NaN,1/60),0);
});
test('reply nod is brief and reduced motion suppresses it',()=>{
  assert.ok(Math.abs(replyNod(.2))>.1);
  assert.equal(replyNod(.2,true),0);assert.equal(replyNod(3),0);assert.equal(replyNod(-1),0);
});


test('camera keyboard shortcuts keep browser-modified keys untouched',()=>{
  assert.equal(avatarKeyAction({key:'ArrowLeft'}),'left');
  assert.equal(avatarKeyAction({key:'ArrowUp',shiftKey:true}),'pan-up');
  assert.equal(avatarKeyAction({key:'+'}),'in');assert.equal(avatarKeyAction({key:'Home'}),'reset');
  assert.equal(avatarKeyAction({key:'ArrowLeft',metaKey:true}),null);
  assert.equal(avatarKeyAction({key:'a'}),null);
});
