const vscode=require('vscode'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
exports.run=async()=>{
  const root=process.env.NETCLAW_SETUP_PREVIEW_ROOT;if(!root)throw Error('An isolated preview root is required.');
  const harness=process.env.NETCLAW_SETUP_PREVIEW_HARNESS||'openclaw',shape=process.env.NETCLAW_SETUP_PREVIEW_SHAPE||'focused';
  const extension=vscode.extensions.getExtension('NetClaw.netclaw');await extension.activate();
  for(const key of ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'])delete process.env[key];
  process.env.NO_PROXY='127.0.0.1,localhost';
  const {chromium}=require(process.env.NETCLAW_SETUP_PLAYWRIGHT||path.join(root,'tools/node_modules/playwright'));
  const endpointFile=path.join(root,'cdp.json'),until=Date.now()+20000;
  while(!fs.existsSync(endpointFile)&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
  const browser=await chromium.connectOverCDP(JSON.parse(fs.readFileSync(endpointFile)).webSocketDebuggerUrl);
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('workbench'));page.setDefaultTimeout(15000);
  const resume=fs.existsSync(path.join(root,'reload.json'));
  const evidence=resume?JSON.parse(fs.readFileSync(path.join(root,'report.json'))):{complete:false,editor:vscode.version,kind:'actual isolated source-development editor with synthetic non-secret draft',harness,shape,checks:[],matrix:[],shots:[],providerCalls:0,installationRuns:0,packaged:false};
  const {checks,matrix,shots}=evidence;
  const save=()=>fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(evidence,null,2),{mode:0o600});
  const mark=text=>{checks.push(text);save();};
  const settle=()=>new Promise(r=>setTimeout(r,100));
  const draftFile=path.join(root,'user/User/globalStorage/netclaw.netclaw/state',createHash('sha256').update('setup-draft').digest('hex')+'.json');
  const draft=()=>JSON.parse(fs.readFileSync(draftFile)).value;
  const wait=async(predicate,label)=>{const until=Date.now()+15000;while(Date.now()<until){if(await predicate())return;await settle();}throw Error('Timed out: '+label);};
  const findFrame=async()=>{let result;await wait(async()=>{for(const f of page.frames())if(await f.locator('#setup-search').isVisible().catch(()=>false)){result=f;return true;}return false;},'setup webview');return result;};
  let frame;
  try{
    await vscode.commands.executeCommand('workbench.action.closeSidebar');
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    await vscode.commands.executeCommand('netclaw.setupClaw');frame=await findFrame();
    const option=id=>frame.locator(`button[data-action="comms-option"][data-comms="${harness}-${id}"]`);
    const choose=async(id,selected)=>{await option(id).focus();await page.keyboard.press('Enter');await wait(async()=>await option(id).getAttribute('aria-pressed')===String(selected),id+' selection');await wait(async()=>!(await option(id).isDisabled()),id+' action settled');};
    const retained=()=>{const claw=draft().claws.find(c=>c.id==='fixture');assert.deepEqual(claw.channels.map(c=>c.id),['discord']);assert.deepEqual(claw.settings.DISCORD_ALLOWED_USERS,{kind:'value',value:'123456789012345678'});return claw;};
    const settingsInput=async()=>{
      await frame.locator('button[data-action="settings"][data-owner="fixture"]').first().click();
      const native=page.locator('.quick-input-widget input');await native.waitFor({state:'visible'});await native.fill('Discord Allowed Users');await page.keyboard.press('Enter');
      await wait(async()=>await page.locator('.quick-input-title').innerText().catch(()=>'')==='Discord Allowed Users','native Discord setting input');
      return native;
    };
    if(resume){
      retained();await frame.locator('#comms-search').fill('Discord');assert.equal(await option('discord').getAttribute('aria-pressed'),'true');
      const native=await settingsInput();assert.equal(await native.inputValue(),'123456789012345678');await page.keyboard.press('Escape');
      mark('Actual VS Code window and extension-host reload retained Discord selection and native setting value.');
      const reportFile=process.env.NETCLAW_SETUP_PREVIEW_REPORT;
      if(reportFile){
        const content=fs.readFileSync(reportFile,'utf8'),report=JSON.parse(content);assert.equal(report.export,'redacted');
        assert.ok(!content.includes(root));assert.ok(!/private-token-canary|installer-fixture-secret/.test(content));
        const document=await vscode.workspace.openTextDocument(vscode.Uri.file(reportFile));await vscode.window.showTextDocument(document,{preview:false});
        assert.equal(vscode.window.activeTextEditor.document.getText(),content);
        evidence.report={method:'Opened and inspected actual engine-generated redacted report without editing; did not invoke setup report command',sha256:createHash('sha256').update(content).digest('hex'),export:report.export};
        mark('Actual redacted engine report opened in the isolated editor; no setup action or provider connection executed.');
      }else evidence.report={status:'not_executed',reason:'No actual engine report supplied to this isolated editor pass.'};
      evidence.complete=true;save();await browser.close();return;
    }
    assert.match(await frame.locator('.setup-banner').innerText(),/Existing NetClaw detected/);mark('Existing NetClaw fixture disclosure visible; separate installation explained.');
    assert.equal(await frame.locator('#setup-capabilities .capability').count(),110);mark('All 110 catalog component cards rendered without fetching their links.');
    const search=frame.locator('#setup-search');await search.focus();await page.keyboard.type('subnet');
    assert.ok(await frame.locator('#setup-capabilities .capability').count()<110);assert.equal(await search.inputValue(),'subnet');
    await page.keyboard.press('Tab');assert.equal(await frame.evaluate(()=>document.activeElement?.tagName),'SUMMARY');
    mark('Keyboard search retains typed text and Tab reaches the next native disclosure control.');await search.fill('');
    const commsSearch=frame.locator('#comms-search');
    for(const text of ['WhatsApp','Twilio','Zoom']){await commsSearch.fill(text);assert.ok(await frame.locator('#comms-cards .capability').count()>0);assert.match(await frame.locator('#comms-count').innerText(),new RegExp('options for '+harness));}
    await commsSearch.fill('Slack');await choose('slack',true);
    await commsSearch.fill('Discord');await choose('discord',true);
    const native=await settingsInput();await native.fill('123456789012345678');await page.keyboard.press('Enter');
    await wait(()=>draft().claws[0].settings.DISCORD_ALLOWED_USERS?.value==='123456789012345678','non-secret native setting saved');
    await commsSearch.fill('Slack');assert.equal(await option('slack').getAttribute('aria-pressed'),'true');await choose('slack',false);
    retained();await commsSearch.fill('Discord');assert.equal(await option('discord').getAttribute('aria-pressed'),'true');
    mark('WhatsApp, Twilio and Zoom are discoverable; keyboard multiselection and Slack removal preserve Discord and its native-entered non-secret setting.');
    const cancel=await settingsInput();assert.equal(await cancel.inputValue(),'123456789012345678');await cancel.fill('cancelled-fixture-change');await page.keyboard.press('Escape');retained();
    mark('Cancelling a native setting edit preserves its saved value.');
    if(harness==='hermes'){
      await commsSearch.fill('Matrix');assert.ok(await option('matrix').isDisabled());assert.match(await option('matrix').locator('..').innerText(),/different host/);
      mark('Hermes Matrix is visible with a host restriction and disabled on this Mac.');
    }
    if(shape==='risk'){
      for(const [query,id] of [['Twilio','twilio-core'],['Zoom','zoom']]){await commsSearch.fill(query);assert.ok(await option(id).isDisabled());}
      await frame.locator('.setup-branches [data-select="member"]').click();await commsSearch.fill('Slack');assert.ok(await option('slack').isDisabled());
      assert.ok(await frame.locator('#setup-comms button[data-action="channel"]').isDisabled());
      for(const [query,id,component] of [['Twilio','twilio-core','twilio'],['Zoom','zoom','zoom-rtms']]){
        await commsSearch.fill(query);assert.ok(!(await option(id).isDisabled()));await choose(id,true);
        assert.ok(draft().claws.find(c=>c.id==='member').capabilities.components.includes(component));
      }
      assert.equal(await frame.locator('button[data-action="zoom-binding"]').count(),1);
      assert.deepEqual(draft().claws.find(c=>c.id==='member').channels,[]);
      await frame.locator('.setup-branches [data-select="fixture"]').click();retained();
      mark('Border conversation controls stay available; Border Twilio/Zoom tool selection and member conversation controls refuse ownership. Member Twilio/Zoom tool selection succeeds without activation.');
    }else{
      for(const [query,id] of [['Twilio','twilio-core'],['Zoom','zoom']]){await commsSearch.fill(query);assert.ok(!(await option(id).isDisabled()));}
      mark('Focused claw exposes conversation channels and Twilio/Zoom tools as selectable Comms options.');
    }
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');await vscode.commands.executeCommand('netclaw.setupClaw');frame=await findFrame();
    await frame.locator('#comms-search').fill('Discord');assert.equal(await option('discord').getAttribute('aria-pressed'),'true');retained();
    mark('Closing and reopening the actual setup panel retains channel selection and native setting.');
    await frame.locator('#comms-search').fill('');
    for(const [theme,width] of [['Default Light Modern',360],['Default Dark Modern',700],['Default High Contrast',1200]]){
      await vscode.workspace.getConfiguration('workbench').update('colorTheme',theme,vscode.ConfigurationTarget.Global);
      await page.setViewportSize({width:width+48,height:1050});await new Promise(r=>setTimeout(r,250));
      const actual=await frame.evaluate(()=>innerWidth);await page.setViewportSize({width:page.viewportSize().width+width-actual,height:1050});
      await frame.locator('#setup-comms').scrollIntoViewIfNeeded();await new Promise(r=>setTimeout(r,250));
      const geometry=await frame.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
      assert.ok(geometry.scroll<=geometry.client+2,JSON.stringify(geometry));assert.ok(Math.abs(geometry.viewport-width)<=2,JSON.stringify(geometry));
      assert.equal(await frame.locator('button').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.getAttribute('aria-label')).length),0);
      matrix.push({theme,width,...geometry});const file=path.join(root,'setup-'+width+'.png');await page.screenshot({path:file});shots.push(file);
    }
    await vscode.workspace.getConfiguration('window').update('zoomLevel',Math.log(2)/Math.log(1.2),vscode.ConfigurationTarget.Global);
    await new Promise(r=>setTimeout(r,300));assert.equal(await frame.locator('h1').isVisible(),true);
    evidence.zoomGeometry=await frame.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(evidence.zoomGeometry.scroll<=evidence.zoomGeometry.client+2);
    mark('Light/dark/high-contrast layouts at 360/700/1200px and 200% zoom retain reachable controls without horizontal overflow.');
    await vscode.workspace.getConfiguration('window').update('zoomLevel',0,vscode.ConfigurationTarget.Global);
    fs.writeFileSync(path.join(root,'reload.json'),JSON.stringify({harness,shape}),{mode:0o600});save();await browser.close();
    setTimeout(()=>void vscode.commands.executeCommand('workbench.action.reloadWindow'),100);return {reloading:true};
  }catch(error){
    evidence.error=String(error.stack||error);save();await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});await browser.close();throw error;
  }
};
