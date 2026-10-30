import {validateShape} from './plan';

export interface CommsEntry {
  id:string;inventory:'channel'|'related'|'netclaw';harness:'openclaw'|'hermes';channelId:string;nativeId:string;
  name:string;aliases:string[];kind:string;roles:string[];hosts:string[];documentation:string;checkedAt:string;
  baseline:{version:string;commit:string;support:string;evidence:string};component:string|null;
  setup:{disposition:string;method:string;adapter:string|null;reason:string;settings:any[];access:string[];
    dependencies:any[];startupEffects:string[];readback:string|null};qualification:string;
}
export interface CommsManifest {schema:1;revision:string;checkedAt:string;entries:CommsEntry[]}

export function commsReportSummary(report:any):string|undefined {
  const rows=(Array.isArray(report?.installations)?report.installations:[]).flatMap((i:any)=>Array.isArray(i?.comms)?i.comms:[]);
  if(!rows.length)return undefined;
  const count=(dimension:string,code:string)=>rows.filter((r:any)=>r?.[dimension]?.state==='verified'&&r[dimension].code===code).length;
  return `Comms: ${count('configuration','configuration_valid')} configured; ${count('authentication','authentication_verified')} authenticated; `+
    `${count('transport','transport_connected')} connected; ${count('inbound','inbound_verified')} inbound verified; `+
    `${count('outbound','submission_accepted')} outbound submitted; ${count('outbound','delivery_verified')} delivery confirmed. `+
    'The report shows each channel and its remaining checks.';
}

export function channelTestChoices(plan:any,manifest:CommsManifest){
  const choices:{key:string;owner:string;channel:string;direction:'outbound';label:string;picked:boolean}[]=[];
  for(const claw of plan.claws||[])for(const selected of claw.channels||[]){
    const entry=manifest.entries.find(e=>e.harness===claw.harness&&e.channelId===selected.id&&e.inventory==='channel');
    // These pinned native send/receipt contracts are implemented today. An
    // inbound request is never silently turned into an outbound test.
    const supported=['slack','discord','telegram'].includes(selected.id)||claw.harness==='hermes'&&selected.id==='sms';
    if(!entry||!['typed','native'].includes(entry.setup.disposition)||!supported)continue;
    choices.push({key:`${claw.id}/${selected.id}/outbound`,owner:claw.id,channel:selected.id,direction:'outbound',
      label:`${claw.displayName||claw.id} · ${entry.name} · Outbound`,picked:(plan.verification?.channelTests||[]).some((t:any)=>
        t.owner===claw.id&&t.channel===selected.id&&(t.direction||'outbound')==='outbound')});
  }
  return choices;
}

export function setChannelTests(plan:any,keys:string[],manifest:CommsManifest){
  const choices=channelTestChoices(plan,manifest),allowed=new Map(choices.map(c=>[c.key,c]));
  if(new Set(keys).size!==keys.length||keys.some(key=>!allowed.has(key)))throw Error('Select available channel test requests.');
  const next=structuredClone(plan),keyFor=(t:any)=>`${t.owner}/${t.channel}/${t.direction||'outbound'}`;
  const prior=next.verification.channelTests||[];
  // Imported directions/destinations are retained exactly. Editing the shown
  // choices changes only those choices, not other requests in an imported plan.
  const tests=prior.filter((t:any)=>!allowed.has(keyFor(t))||keys.includes(keyFor(t)));
  for(const key of keys)if(!tests.some((t:any)=>keyFor(t)===key)){
    const c=allowed.get(key)!;tests.push({owner:c.owner,channel:c.channel,direction:c.direction,destinationRef:'native-test'});
  }
  if(tests.length>64)throw Error('A plan supports at most 64 channel test requests.');
  next.verification.channelTests=tests;return next;
}

export function setZoomBinding(plan:any,owner:string,port:number|null){
  const next=structuredClone(plan),others=(next.commsBindings||[]).filter((b:any)=>b.owner!==owner);
  if(port===null){next.commsBindings=others;return next;}
  const claw=next.claws?.find((c:any)=>c.id===owner),borders=(next.claws||[]).filter((c:any)=>c.role==='border');
  if(next.shape!=='risk'||!claw||claw.role==='border'||!claw.capabilities?.components?.includes('zoom-rtms')||borders.length!==1)
    throw Error('Select Zoom on a member in this Risk plan.');
  if(!Number.isInteger(port)||port<1024||port>65535||others.some((b:any)=>b.border===borders[0].id||b.port===port)||
     next.claws.some((c:any)=>Object.values(c.endpoints||{}).includes(port)))throw Error('Choose an unused port and an unbound Border.');
  const prior=(next.commsBindings||[]).find((b:any)=>b.owner===owner);
  for(const key of ['N2N_ZOOM_CHANNEL_HOST','N2N_ZOOM_CHANNEL_PORT','N2N_ZOOM_CHANNEL_SECRET'])delete claw.settings?.[key];
  next.commsBindings=[...others,{id:prior?.id||owner,integration:'zoom',owner,border:borders[0].id,port}];
  return next;
}

export function validateComms(data:CommsManifest,schema:any){
  if(!validateShape(data,schema))throw Error('Comms catalog is invalid.');
  const ids=new Set<string>();
  for(const e of data.entries){
    const url=new URL(e.documentation);
    if(ids.has(e.id)||url.protocol!=='https:'||url.username||url.password)throw Error('Comms catalog identity is invalid.');
    if(e.inventory==='channel'&&(e.roles.includes('member')||e.component!==null))throw Error('Comms owner contract is invalid.');
    if(e.inventory==='netclaw'&&(e.roles.includes('border')||!e.component))throw Error('Comms tool owner contract is invalid.');
    ids.add(e.id);
  }
}

export function discoverComms(manifest:CommsManifest,query='',harness?:string,claw?:any,host?:string){
  const needle=query.trim().toLocaleLowerCase();
  return manifest.entries.filter(e=>(!harness||e.harness===harness)&&
    [e.name,e.channelId,e.kind,...e.aliases].join(' ').toLocaleLowerCase().includes(needle)).map(e=>{
      const version=e.harness==='hermes'?claw?.runtimeVersion?.replace(/^v/,''):claw?.runtimeVersion;
      const state=claw?.role&&!e.roles.includes(claw.role)?'role-restricted':host&&!e.hosts.includes(host)?'host-restricted':
        version&&version!==e.baseline.version?'version-unqualified':e.setup.disposition;
      return {...structuredClone(e),state,selectable:['typed','native'].includes(state)};
    });
}

export function channelFields(claw:any,id:string,catalog:any,manifest:CommsManifest){
  const e=manifest.entries.find(e=>e.harness===claw.harness&&e.channelId===id&&(e.inventory==='channel'||id==='webex'));
  if(!e)throw Error('Channel is unavailable for this runtime.');
  const fallback=catalog.choices.find((c:any)=>c.kind==='channel'&&c.id===id)?.settings||[];
  return e.setup.settings.length?e.setup.settings:fallback;
}

export function selectChannels(claw:any,ids:string[],catalog:any,manifest:CommsManifest){
  if(ids.length>64||new Set(ids).size!==ids.length||ids.includes('none')&&ids.length!==1)throw Error('Select distinct channels or None.');
  if(ids[0]==='none')ids=[];
  const next=structuredClone(claw),prior=new Set<string>((claw.channels||[]).flatMap((c:any)=>c.settingKeys||[]));
  next.settings ||= {};
  next.channels=ids.map(id=>{
    const e=manifest.entries.find(e=>e.harness===claw.harness&&e.channelId===id&&(e.inventory==='channel'||id==='webex'));
    if(!e||!e.roles.includes(claw.role||'focused'))throw Error('Channel belongs to a different runtime or owner role.');
    return {id,settingKeys:channelFields(claw,id,catalog,manifest).map((f:any)=>f.key)};
  });
  const fields:any[]=[...ids.flatMap(id=>channelFields(claw,id,catalog,manifest)),
    ...catalog.components.filter((c:any)=>claw.capabilities?.components?.includes(c.id)).flatMap((c:any)=>c.settings),
    ...catalog.choices.filter((c:any)=>c.kind==='provider'&&c.id===claw.provider?.id||c.kind==='harness'&&c.id===claw.harness).flatMap((c:any)=>c.settings)];
  const keep=new Set(fields.map(f=>f.key));
  for(const key of prior)if(!keep.has(key))delete next.settings[key];
  for(const f of ids.flatMap(id=>channelFields(claw,id,catalog,manifest)))if(f.classification==='secret'&&!next.settings[f.key])
    next.settings[f.key]={kind:'secret',key:f.key,owner:claw.id,source:'prompt'};
  return next;
}
