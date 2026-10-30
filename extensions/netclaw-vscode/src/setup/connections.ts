import {HudClient,endpoint} from '../client/hud';
export interface SetupConnection {id:string;label:string;harness:'openclaw'|'hermes';installationId:string;home:string;workspace:string;url:string}

/** Authentication and selected-home checks precede every native save review. */
export async function inspectSetupConnection(candidate:SetupConnection,client=new HudClient(candidate.url,candidate.installationId)){
  if(!['openclaw','hermes'].includes(candidate.harness)||! /^[a-f0-9-]{36}$/.test(candidate.installationId)||
    !candidate.home.startsWith('/')||!candidate.workspace.startsWith('/')||
    (candidate.harness==='hermes'&&candidate.workspace!==candidate.home)||endpoint(candidate.url)!==candidate.url)throw Error('Setup connection is invalid.');
  try{
    const runtime=await client.connect();await client.session();
    const management=await client.request<any>('GET','/api/hud/management');
    if(runtime.installationId!==candidate.installationId||runtime.kind!==candidate.harness||runtime.readiness?.ready!==true||
      management.installationId!==candidate.installationId||management.kind!==candidate.harness||management.home!==candidate.home||
      (candidate.harness==='openclaw'&&management.expectedWorkspace!==candidate.workspace))throw Error('This HUD no longer matches the verified setup. Run verification again.');
    return {...candidate};
  }finally{
    try{await client.request('POST','/api/hud/session/revoke',{});}catch{}
    client.close();
  }
}
