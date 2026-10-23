import fs from "node:fs";
import path from "node:path";
export function securityFixture(root, product, runtimeHome, installationId) {
  const dir = path.join(fs.realpathSync(root), product),
    securityHome = path.join(dir, "config");
  fs.mkdirSync(securityHome, { recursive: true });
  const executable = path.join(dir, product);
  const rules = {
    allowed: [
      { name: "show_routes", connector: "openclaw", reason: "Read only" },
    ],
    denied: [{ name: "delete_file", connector: "", reason: "Destructive" }],
  };
  const policy = {
    version: 1,
    filesystem_policy: { read_only: ["/usr"], read_write: ["/sandbox"] },
    process: { run_as_user: "sandbox" },
    network_policies: {
      existing: {
        name: "existing",
        endpoints: [
          {
            host: "api.example.com",
            port: 443,
            protocol: "rest",
            access: "read-only",
            enforcement: "enforce",
          },
        ],
        binaries: [{ path: "/usr/bin/curl" }],
        credentials: { token: "fixture-hidden-token" },
      },
    },
  };
  const state = path.join(dir, "state.json");
  fs.writeFileSync(
    state,
    JSON.stringify({ policy, version: 1, source: "sandbox" }),
  );
  fs.writeFileSync(
    path.join(securityHome, "config.yaml"),
    JSON.stringify({
      asset_policy: { tool: rules },
      guardrail: { mode: "action", block_at: "HIGH" },
      private: { token: "fixture-hidden-token" },
      unrelated: "preserved",
    }),
  );
  fs.mkdirSync(path.join(securityHome, "openshell/gateways/fixture-gateway"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(securityHome, "openshell/gateways/fixture-gateway/metadata.json"),
    JSON.stringify({ endpoint: "https://fixture.invalid" }),
  );
  fs.writeFileSync(
    executable,
    `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const args=process.argv.slice(2),product=${JSON.stringify(product)},home=${JSON.stringify(securityHome)},stateFile=${JSON.stringify(state)};
const config=path.join(home,'config.yaml');
const out=v=>console.log(typeof v==='string'?v:JSON.stringify(v));
const fail=()=>{console.error('password=private-fixture-error');process.exit(3);};
if(fs.existsSync(path.join(path.dirname(stateFile),'fail')))fail();
if(args.length===1&&args[0]==='--help'){out('--gateway --workspace');process.exit(0);}
if(args.includes('--version')){out(product+' fixture contract 1');process.exit(0);}
if(product==='defenseclaw'){
 if(process.env.DEFENSECLAW_HOME!==home||process.env.DEFENSECLAW_CONFIG!==config)fail();
 const data=JSON.parse(fs.readFileSync(config));
 const get=k=>k.split('.').reduce((v,k)=>v[k],data);
 if(args[0]==='status')out({data_dir:home,environment:'fixture',sidecar:{running:false},connectors:[{name:'openclaw',mode:'action',enabled:true}]});
 else if(args[0]==='alerts')out([{timestamp:'2026-10-11',severity:'HIGH',action:'blocked',target:'delete_file',details:'password=fixture-hidden-token'}]);
 else if(args[0]==='tool')out([{name:'delete_file',status:'blocked'}]);
 else if(args.includes('--help'))out('--expect-sha256 --json');
 else if(args[1]==='get')console.log(JSON.stringify(get(args[2])));
 else if(args[1]==='set'){
  if(crypto.createHash('sha256').update(fs.readFileSync(config)).digest('hex')!==args[args.indexOf('--expect-sha256')+1])fail();
  if(fs.existsSync(path.join(path.dirname(stateFile),'refuse-write')))fail();
  const keys=args[2].split('.');let obj=data;for(const key of keys.slice(0,-1))obj=obj[key];obj[keys.at(-1)]=JSON.parse(args[3]);
  fs.writeFileSync(config,JSON.stringify(data));out('Saved');
 }else fail();
}else{
 if(process.env.XDG_CONFIG_HOME!==home||args[0]!=='--gateway'||args[1]!=='fixture-gateway'||args[2]!=='--workspace'||args[3]!=='default'||process.env.OPENSHELL_GATEWAY_ENDPOINT||process.env.OPENSHELL_GATEWAY_INSECURE)fail();
 const cmd=args.slice(4), state=JSON.parse(fs.readFileSync(stateFile));
 if(cmd.includes('--help'))out('--base --full --output');
 else if(cmd[0]==='gateway')out({gateway:'fixture-gateway',status:'fixture',authentication:'unverified'});
 else if(cmd[0]==='logs')out('INFO blocked api.example.com\\npassword=fixture-hidden-token');
 else if(cmd[0]==='policy'&&cmd[1]==='get')out({sandbox:'fixture-sandbox',version:state.version,active_version:state.version,policy_source:state.source,policy:state.policy});
 else if(cmd[0]==='policy'&&cmd[1]==='set'){
  if(fs.existsSync(path.join(path.dirname(stateFile),'refuse-write')))fail();
  state.policy=JSON.parse(fs.readFileSync(cmd[cmd.indexOf('--policy')+1]));state.version++;fs.writeFileSync(stateFile,JSON.stringify(state));out('Loaded');
 }else fail();
}
`,
    { mode: 0o700 },
  );
  return {
    target: {
      product,
      runtimeHome,
      installationId,
      kind: "openclaw",
      executable,
      securityHome,
      gateway: product === "openshell" ? "fixture-gateway" : undefined,
      workspace: product === "openshell" ? "default" : undefined,
      sandbox: product === "openshell" ? "fixture-sandbox" : undefined,
    },
    dir,
    state,
    config: path.join(securityHome, "config.yaml"),
  };
}
