(()=>{
  const vscode=acquireVsCodeApi();let sequence=0,snapshot,selected='',query='',commsQuery='',validation;
  const main=document.getElementById('setup');
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const send=(type,data={})=>vscode.postMessage({type,sequence:++sequence,...data});
  const button=(action,label,extra='')=>`<button data-action="${action}" ${extra}>${escape(label)}</button>`;
  const render=()=>{
    if(!snapshot)return;const plan=snapshot.answers,claws=plan.claws||[];
    if(!claws.some(c=>c.id===selected))selected=claws[0]?.id||'';
    const claw=claws.find(c=>c.id===selected),focus=document.activeElement?.getAttribute('data-action');
    main.innerHTML=`<div class="setup-banner ${snapshot.installations.length?'detected':''}" role="status"><strong>${snapshot.installations.some(i=>i.netclaw)?'Existing NetClaw detected. This setup creates a separate installation.':snapshot.installations.length?'Existing claw detected. Choose a separate, empty runtime home.':'Create a separate NetClaw installation.'}</strong><p>Each claw has its own identity, home, provider credentials, services and connection. Detection covers saved bindings, known default homes and locations you select.</p>${button('find-installation','Inspect another claw home')}${snapshot.installations.map(i=>`<p>${escape(i.label||i.harness||'Installation')} · ${escape(i.home)} · ${escape(i.state)}</p>`).join('')}</div>
    <div class="setup-layout"><nav class="setup-tree" aria-label="Setup steps"><h2>Your setup</h2><p class="setup-hint">Prerequisite checks inspect this host and contact GitHub, npm and PyPI.</p>
      ${[['prerequisites','1 · Platform & prerequisites'],['source','2 · NetClaw source'],['harness','3 · Agent harness'],['provider','4 · Provider & model'],['comms','5 · Comms'],['shape','6 · Focused or Risk'],['capabilities','7 · Capabilities & members'],['settings','8 · Settings'],['testbed','9 · Testbed mode & sources'],['posture','10 · Identity & posture'],['validate','11 · Review & run']].map(([id,label])=>button(id,label,`data-owner="${escape(selected)}" ${['provider','comms'].includes(id)&&!claw?.harness||['settings','inventory','testbed'].includes(id)&&!claw?.capabilities?'disabled':''}`)).join('')}
      ${claws.length?`<div class="setup-branches" aria-label="Claw branches">${claws.map(c=>`<button data-select="${escape(c.id)}" aria-pressed="${c.id===selected}">${escape(c.displayName||'New claw')} · ${escape(c.role||'shape pending')}<small>${escape(c.harness||'choose harness')} · ${escape(c.provider?.id||'choose provider')}</small></button>`).join('')}</div>`:''}
      <details><summary>Setup glossary</summary><dl><dt>Harness</dt><dd>The agent runtime: OpenClaw or Hermes.</dd><dt>Provider</dt><dd>The service or local program that runs your model.</dd><dt>Channel</dt><dd>A conversation destination such as Slack.</dd><dt>MCP</dt><dd>A connection that gives the agent tools.</dd><dt>Skill</dt><dd>Instructions for using a capability.</dd><dt>Risk</dt><dd>A team of claws on this host.</dd><dt>Border</dt><dd>The claw that routes work to members.</dd><dt>Member</dt><dd>An independent claw with its own capabilities and credentials.</dd><dt>Testbed</dt><dd>Your device inventory and connection references.</dd></dl></details><hr>${button('import' ,'Import plan')}${button('save','Save plan')}
      <p class="setup-hint">Saved plans contain credential references. Secret values are entered in native prompts during installation.</p>
    </nav><section class="setup-main" aria-label="Installation choices">
      <section class="setup-card"><div class="setup-card-title"><h2>${escape(plan.shape==='risk'?'Your Risk':plan.shape==='focused'?'Your Focused claw':'Choose a shape')}</h2>${button('shape','Choose shape')}${button('advisor','Shape Advisor')}</div>
      <p>A <strong>Focused claw</strong> owns its selected tools. A <strong>Risk</strong> has a Border that routes work to independent member claws.</p>
      <p>Source: ${escape(plan.source?plan.source.ref+' · '+plan.source.commit.slice(0,12):'Choose a checkout or published release')} ${plan.source?.dirty?'· reviewed local changes':''}</p>
      <p>Host: ${escape(plan.host?plan.host.platform+' '+plan.host.osVersion:'Not yet bound')} · Posture: ${escape(plan.posture?.mode||'Choose testing or production')}</p></section>
      <section class="setup-card"><div class="setup-card-title"><h2>Claws</h2>${button('claw',claws.length?'Add member':'Define claw',plan.shape==='focused'&&claws.length?'disabled':'')}</div>
      <div class="setup-claws">${claws.map(c=>`<article class="setup-claw ${c.id===selected?'selected':''}"><button data-select="${escape(c.id)}" aria-pressed="${c.id===selected}"><strong>${escape(c.displayName||'New claw')}</strong><span>${escape(c.harness)} · ${escape(c.role)} · ${escape(c.service?.mode)}</span></button><p>${escape(c.runtimeHome)}</p><p>${escape(c.provider?.id)} / ${escape(c.provider?.model)}</p>${button('claw',c.runtimeHome?'Edit definition':'Name & home',`data-owner="${escape(c.id)}"`)}${button('harness','Harness',`data-owner="${escape(c.id)}"`)}${button('provider','Provider',`data-owner="${escape(c.id)}" ${!c.harness?'disabled':''}`)}</article>`).join('')||'<p>Each new claw gets a separate empty home. Existing installations stay available in Connections.</p>'}</div></section>
      ${claw?`<section class="setup-card"><div class="setup-card-title"><h2>${escape(claw.displayName||'New claw')} · configuration</h2>${button('settings','Settings',`data-owner="${escape(claw.id)}"`)}</div><p>${(claw.capabilities?.components||[]).length} selected components · ${(claw.capabilities?.skills||[]).length} skills · ${escape(claw.harnessChoice==='inherit'?'Inherits the Border harness':'Explicit harness choice')}</p><div class="setup-actions">${button('channel','Conversation channel',`data-owner="${escape(claw.id)}" ${claw.role==='member'?'disabled':''}`)}${button('testbed','Testbed mode & sources',`data-owner="${escape(claw.id)}" ${!claw.capabilities?.components?.includes('pyats')?'disabled':''}`)}${button('inventory','Import static inventory',`data-owner="${escape(claw.id)}"`)}${button('identity','Choose identity files',`data-owner="${escape(claw.id)}"`)}${button('ports','Review ports',`data-owner="${escape(claw.id)}"`)}${button('skills','Select skills',`data-owner="${escape(claw.id)}"`)}</div><p>Testbed: ${escape(claw.testbed?.mode||'static')} · Sources: ${escape((claw.testbed?.sources||[]).join(', ')||'Reviewed file')} · Setup does not fetch or activate inventory.</p><p>Channels: ${escape((claw.channels||[]).map(c=>c.id).join(', ')||'None')} · Ports: ${escape(Object.entries(claw.endpoints||{}).map(([k,v])=>k+' '+v).join(' · '))}</p></section>
      <section class="setup-card" id="setup-comms"><div class="setup-card-title"><h2>Comms</h2>${button('channel','Select conversation channels',`data-owner="${escape(claw.id)}" ${claw.role==='member'?'disabled':''}`)}</div><p>Conversation accounts belong to a Focused claw or Border. Members can own separately selected communication tools.</p>${button('comms-guide','Account preparation & setup guide')}${plan.shape==='risk'&&claw.role==='member'&&claw.capabilities?.components?.includes('zoom-rtms')?button('zoom-binding','Zoom Border binding',`data-owner="${escape(claw.id)}"`):''}<label class="setup-search">Find channels, voice or meetings<input id="comms-search" type="search" value="${escape(commsQuery)}" placeholder="Search WhatsApp, Slack, Twilio, Zoom…"></label><p id="comms-count" role="status"></p><div class="setup-capabilities" id="comms-cards"></div></section>
      <section class="setup-card"><h2>Capabilities</h2><label class="setup-search">Find components or skills<input id="setup-search" type="search" value="${escape(query)}" placeholder="Search networking, inventory, diagrams…"></label><div class="setup-capabilities" id="setup-capabilities"></div></section>`:''}
      <section class="setup-card"><h2>Review & run</h2><p>Required checks cover installed files, tool discovery and the owned runtime/HUD. Live inference, messages and device checks require separate review.</p>
      ${(plan.assumptions||[]).length?`<p>Assumptions to review: ${escape(plan.assumptions.join(' · '))}</p>`:''}
      ${(plan.unresolved||[]).length?`<p role="alert">Unresolved: ${escape(plan.unresolved.join(', '))}</p>${button('resolve','Review unresolved decisions')}`:''}
      <div class="setup-actions">${button('verification','Choose verification tiers')}${button('validate','Validate plan')}${button('apply','Review installation',!snapshot.complete||snapshot.busy?'disabled':'')}${snapshot.run?button('resume','Resume explicitly',snapshot.busy?'disabled':''):''}${snapshot.busy?button('pause','Pause at checkpoint'):''}</div>
      <div id="setup-validation" role="status"></div><div id="setup-progress" role="log" aria-live="polite">${snapshot.run?escape('Run '+snapshot.run.runId+' · '+snapshot.run.state):''}</div>
      ${snapshot.run?`<div class="setup-actions">${button('connect-new','Save verified connection')}${button('report','View Claw Report')}${button('verify','Run local verification',snapshot.busy?'disabled':'')}${button('export-report','Export redacted report')}${button('export-detailed','Export detailed local report')}${button('cleanup','Review owned cleanup')}</div>`:''}
      <p class="setup-hint">Closing or reloading the owning editor requests a pause. Installed services stay running. Resume always inspects the saved run first.</p></section>
    </section></div>`;
    renderComponents();renderComms();renderValidation();
    if(snapshot.busy)main.querySelectorAll('button').forEach(b=>{if(b.dataset.action!=='pause')b.disabled=true;});
    if(focus)main.querySelector(`[data-action="${CSS.escape(focus)}"]`)?.focus();
  };
  const renderComponents=()=>{
    const grid=document.getElementById('setup-capabilities'),claw=snapshot?.answers.claws?.find(c=>c.id===selected);if(!grid||!claw)return;
    const items=snapshot.components.filter(c=>(c.title+' '+c.category+' '+c.description+' '+c.skills.join(' ')).toLowerCase().includes(query.toLowerCase()));
    grid.innerHTML=items.map(c=>`<article class="capability ${(claw.capabilities?.components||[]).includes(c.id)?'chosen':''}"><p class="eyebrow">${escape(c.category)} · ${escape(c.kind)}</p><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p>${c.unavailable?`<p class="setup-hint">Unavailable: ${escape(c.unavailable)}</p>`:''}<p class="setup-hint">${c.skills.length} skills${c.dependencies.length?' · Depends on '+escape(c.dependencies.join(', ')):''}${c.native?' · Native setup step':''}</p><details><summary>Requirements & fit</summary><p>${escape(c.whenToChoose)}</p><p>Platforms: ${escape((c.platforms||[]).join(', '))}. ${escape(c.platformReason)}</p><p>Prerequisites: ${escape((c.prerequisites||[]).join(' · '))}</p><p>Tool access: ${escape(c.access?.mode||'unknown')}. ${escape(c.access?.note)}</p><p>Tool schemas: ${escape(c.estimate?.schemas??'unknown')} (${escape(c.estimate?.method||'unknown')}). ${escape(c.estimate?.reason)}</p><p>Required or conditional settings: ${escape((c.requiredSettings||[]).join(', ')||'None')}</p></details>${button('component',(claw.capabilities?.components||[]).includes(c.id)?'Remove':c.unavailable?'Unavailable':'Add',`data-owner="${escape(claw.id)}" data-component="${escape(c.id)}" ${!claw.capabilities||c.unavailable&&!(claw.capabilities?.components||[]).includes(c.id)||snapshot.answers.host&&!c.platforms?.includes(snapshot.answers.host.platform)?'disabled':''} aria-pressed="${(claw.capabilities?.components||[]).includes(c.id)}"`)}${button('documentation','Documentation',`data-component="${escape(c.id)}"`)}</article>`).join('')||'<p>No matching capabilities.</p>';
  };
  const renderComms=()=>{
    const grid=document.getElementById('comms-cards'),claw=snapshot?.answers.claws?.find(c=>c.id===selected);if(!grid||!claw)return;
    const items=(snapshot.comms||[]).filter(e=>e.harness===claw.harness&&(e.title+' '+e.channelId+' '+e.kind+' '+e.aliases.join(' ')).toLowerCase().includes(commsQuery.toLowerCase()));
    const labels={'typed':'Guided setup','native':'Guided native setup','incomplete-adapter':'Setup support in progress','unavailable-baseline':'Unavailable in this runtime version','incompatible-dependency':'Incompatible dependency','reference-only':'Migration reference'};
    grid.innerHTML=items.map(e=>{
      const role=e.roles.includes(claw.role||'focused'),host=!snapshot.answers.host||e.hosts.includes(snapshot.answers.host.platform),version=!claw.runtimeVersion||(e.harness==='hermes'?claw.runtimeVersion.replace(/^v/,''):claw.runtimeVersion)===e.version;
      const selected=e.component?['typed','native'].includes(e.disposition)&&(claw.capabilities?.components||[]).includes(e.component):(claw.channels||[]).some(c=>c.id===e.channelId);
      const selectable=role&&host&&version&&['typed','native'].includes(e.disposition)&&(!e.component||!!claw.capabilities);
      const state=!role?'Requires a different owner role':!host?'Requires a different host':!version?'Requires a qualified runtime version':labels[e.disposition]||'Unverified';
      return `<article class="capability ${selected?'chosen':''}"><p class="eyebrow">${escape(e.harness)} · ${escape(e.kind.replaceAll('-',' '))}</p><h3>${escape(e.title)}</h3><p>${escape(state)}</p><p class="setup-hint">Owner: ${escape(e.roles.join(' or '))} · Runtime ${escape(e.version)}</p><p>${escape(e.reason)}</p><p class="setup-hint">Qualification: ${escape(e.qualification)}. Selection does not prove connection or delivery.</p>${button('comms-option',selected?'Remove':e.component?'Add tools':'Add channel',`data-owner="${escape(claw.id)}" data-comms="${escape(e.id)}" ${!selectable&&!selected?'disabled':''} aria-pressed="${selected}"`)}${button('comms-documentation','Setup guide',`data-comms="${escape(e.id)}"`)}</article>`;
    }).join('')||'<p>No matching Comms options for this runtime.</p>';
    document.getElementById('comms-count').textContent=items.length+' options for '+claw.harness;
  };
  const renderValidation=()=>{
    const output=document.getElementById('setup-validation');
    if(!output||!validation||validation.hash!==snapshot?.hash)return;
    const report=validation.report;
    output.textContent=report.valid?
      `Plan structure is valid. ${report.configurationRequired?.length||0} settings need configuration. Native review is still required.`:
      (report.errors||[]).map(e=>(e.pointer||'Plan')+' · '+e.code).join('\n');
  };
  document.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target||target.disabled)return;
    if(target.dataset.select){selected=target.dataset.select;render();return;}
    if(target.dataset.action==='comms'){document.getElementById('setup-comms')?.scrollIntoView();document.getElementById('comms-search')?.focus();return;}
    if(target.dataset.action)send(target.dataset.action,{owner:target.dataset.owner,component:target.dataset.component,comms:target.dataset.comms});
  });
  document.addEventListener('input',event=>{if(event.target.id==='setup-search'){query=event.target.value;renderComponents();}if(event.target.id==='comms-search'){commsQuery=event.target.value;renderComms();}});
  window.addEventListener('message',({data})=>{
    if(data.type==='snapshot'){snapshot=data;render();}
    if(data.type==='validation'){
      validation={hash:snapshot?.hash,report:data.report};renderValidation();
    }
    if(data.type==='progress'){
      const output=document.getElementById('setup-progress');if(output){const line=document.createElement('p');line.textContent=[data.event.owner,data.event.phase,data.event.state,data.event.code].filter(Boolean).join(' · ');output.append(line);while(output.children.length>100)output.firstElementChild.remove();}
    }
  });send('ready');
})();
