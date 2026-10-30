export interface TestbedPolicy {mode:'static'|'dynamic';sources:string[]}
export interface TestbedSource {id:string;label:string;component:string|null;upstreamNative:string|null;help:string;reference:string}
export function setTestbed(plan:any,owner:string,value:TestbedPolicy,sources:TestbedSource[]){
  const next=structuredClone(plan),claw=next.claws?.find((c:any)=>c.id===owner);
  if(!claw?.capabilities?.components?.includes('pyats'))throw Error('Select pyATS before configuring its testbed.');
  if(!value||!['static','dynamic'].includes(value.mode)||!Array.isArray(value.sources)||new Set(value.sources).size!==value.sources.length||value.sources.some(id=>!sources.some(s=>s.id===id))||
     (value.mode==='dynamic'?!value.sources.length:!!value.sources.length))throw Error('Choose a valid mode and one or more dynamic sources.');
  claw.testbed={mode:value.mode,sources:[...value.sources].sort()};
  if(value.mode==='dynamic')next.inventory=(next.inventory||[]).filter((item:any)=>item.owner!==owner);
  return next;
}
