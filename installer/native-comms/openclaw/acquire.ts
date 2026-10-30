/** Acquisition only: no runtime plugin loader, account setup or activation. */
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';

import {APPROVED_PACKAGES} from './netclaw-comms-contract.mjs';
const APPROVED = APPROVED_PACKAGES as Record<string,{package:string,version:string,pluginId:string,nativeId:string,integrity:string}>;

function read(file:string,privateFile=false){
  if(fs.realpathSync(file)!==file)throw Error('alias');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{
    const info=fs.fstatSync(fd);
    if(!info.isFile()||info.size>4*1024*1024||info.uid!==process.getuid!()||privateFile&&(info.mode&0o077))throw Error('input');
    return JSON.parse(fs.readFileSync(fd,'utf8'));
  }finally{fs.closeSync(fd);}
}
function inside(root:string,file:string){
  const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);
}
function directory(home:string,relative:string){
  let current=home;
  for(const segment of relative.split('/')){
    current=path.join(current,segment);
    if(!fs.existsSync(current))fs.mkdirSync(current,{mode:0o700});
    const info=fs.lstatSync(current);
    if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==process.getuid!()||(info.mode&0o077))throw Error('directory');
  }
  return current;
}
function output(file:string,value:unknown){
  const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}

async function main(){
  process.umask(0o077);
  const home=process.env.OPENCLAW_STATE_DIR;
  if(!home||!path.isAbsolute(home)||fs.realpathSync(home)!==home||process.argv.length!==3)throw Error('home');
  const owner=read(path.join(home,'.netclaw-setup-owner.json'),true);
  if(!owner.runId||!owner.installationId)throw Error('owner');
  const request=read(process.argv[2],true);
  if(Object.keys(request).sort().join(',')!=='channel,config,integrity,schema'||request.schema!==1||
      !Object.hasOwn(APPROVED,request.channel)||request.integrity!==APPROVED[request.channel].integrity)throw Error('request');
  const attempt=directory(home,'.setup/comms/'+request.channel);
  if(process.argv[2]!==path.join(attempt,'acquire-request.json'))throw Error('request_path');
  const resultFile=path.join(attempt,'acquire-result.json');
  if(fs.existsSync(resultFile))throw Error('attempt_already_settled');
  const startedFile=path.join(attempt,'acquire-started.json');
  if(fs.existsSync(startedFile))throw Error('unsettled_acquisition');
  const configFile=path.join(home,'openclaw.json');
  if(!isDeepStrictEqual(read(configFile,true),request.config))throw Error('configuration_changed');
  // A policy evaluator or runtime hook can execute arbitrary work. Preserve
  // the policy and stop; setup cannot silently omit it or call it blindly.
  if(request.config.security?.installPolicy?.exec)throw Error('unqualified_install_evaluator');
  const {getGlobalHookRunner}=await import('./plugins/hook-runner-global.js');
  if(getGlobalHookRunner()!==null)throw Error('active_runtime_hooks');
  const core=path.resolve(import.meta.dirname,'..');
  if(read(path.join(core,'package.json')).name!=='openclaw'||
     read(path.join(core,'package.json')).version!=='2026.7.1-2')throw Error('selected_host');
  // This entry is installed below the selected host's netclaw-comms directory,
  // making native peer resolution bind to that host, never a build checkout.
  const npmDir=directory(home,'.setup/comms/'+request.channel+'/npm');
  // An interrupted native acquisition may have installed a package before
  // returning. Never replay it on the strength of a missing final receipt.
  if(fs.readdirSync(npmDir).length)throw Error('unsettled_acquisition');
  const cache=directory(home,'.setup/comms/'+request.channel+'/cache');
  const npmrc=path.join(attempt,'npmrc');
  const npmConfig='cache='+JSON.stringify(cache)+'\nignore-scripts=true\nregistry=https://registry.npmjs.org/\n';
  if(fs.existsSync(npmrc)){
    if(fs.lstatSync(npmrc).isSymbolicLink()||fs.readFileSync(npmrc,'utf8')!==npmConfig)throw Error('npm_scope_changed');
  }else fs.writeFileSync(npmrc,npmConfig,{mode:0o600,flag:'wx'});
  process.env.NPM_CONFIG_USERCONFIG=npmrc;
  process.env.npm_config_userconfig=npmrc;
  const {installPluginFromNpmSpec}=await import('./plugins/install.js');
  const approved=APPROVED[request.channel];
  const name=approved.package,version=approved.version,spec=name+'@'+version;
  output(startedFile,{schema:1,channel:request.channel,runId:owner.runId,installationId:owner.installationId});
  const result=await installPluginFromNpmSpec({spec,npmDir,config:request.config,
    expectedPluginId:approved.pluginId,expectedIntegrity:request.integrity,onIntegrityDrift:()=>false,
    mode:'install',logger:{info:()=>{},warn:()=>{}},timeoutMs:180000});
  if(!result.ok)throw Error('acquisition_failed');
  output(path.join(attempt,'native-acquired.json'),{schema:1,channel:request.channel,
    pluginId:result.pluginId,version:result.version,installPath:result.targetDir,
    extensions:result.extensions,npmResolution:result.npmResolution});
  if(result.pluginId!==approved.pluginId||result.version!==version||result.npmResolution?.name!==name||
     result.npmResolution.version!==version||result.npmResolution.integrity!==request.integrity||
     result.npmResolution.resolvedSpec!==spec)throw Error('acquisition_identity');
  const root=fs.realpathSync(result.targetDir);
  if(root!==result.targetDir||!inside(npmDir,root))throw Error('acquisition_path');
  const pkg=read(path.join(root,'package.json'));
  if(pkg.name!==name||pkg.version!==version)throw Error('package_identity');
  const project=path.resolve(root,'../../..'),lock=read(path.join(project,'package-lock.json'));
  const locked=lock.packages?.['node_modules/'+name];
  if(locked?.version!==version||locked?.integrity!==request.integrity)throw Error('package_integrity');
  const {buildPluginDependencyStatus}=await import('./plugins/status-dependencies-core.js');
  const status=buildPluginDependencyStatus({rootDir:root,dependencies:pkg.dependencies,optionalDependencies:pkg.optionalDependencies});
  if(!status.requiredInstalled)throw Error('dependency_missing');
  for(const dependency of status.dependencies){
    if(!dependency.resolvedPath||!inside(npmDir,fs.realpathSync(dependency.resolvedPath)))throw Error('dependency_outside_owner');
  }
  const peer=path.join(root,'node_modules/openclaw');
  // Some catalog plugins intentionally omit a host peer; the native plugin
  // loader supplies SDK aliases for them. Never resolve an unrelated host.
  if((fs.existsSync(peer)||pkg.peerDependencies?.openclaw)&&fs.realpathSync(peer)!==core)throw Error('foreign_host_peer');
  if(!Array.isArray(result.extensions)||!result.extensions.length)throw Error('built_entry');
  // Published plugins retain source entries but ship runtimeExtensions under
  // dist/. Use the same compiled-entry and boundary rules as the pinned host.
  const {validatePackageExtensionEntriesForInstall}=await import('./plugins/package-entry-resolution.js');
  const entries=await validatePackageExtensionEntriesForInstall({packageDir:root,
    extensions:result.extensions,manifest:pkg,allowSourceTypeScriptEntries:false});
  if(!entries.ok)throw Error('built_entry');
  if(!isDeepStrictEqual(read(configFile,true),request.config)||getGlobalHookRunner()!==null)throw Error('configuration_changed');
  output(resultFile,{schema:1,channel:request.channel,pluginId:approved.pluginId,package:name,version,
    integrity:request.integrity,installPath:root,dependencies:true,registered:false,
    npmResolution:result.npmResolution});
}
main().catch((error)=>{
  const codes=new Set(['alias','input','directory','home','owner','request','request_path','attempt_already_settled',
    'configuration_changed','unqualified_install_evaluator','active_runtime_hooks','selected_host','npm_scope_changed',
    'acquisition_failed','acquisition_identity','acquisition_path','package_identity','package_integrity','dependency_missing',
    'dependency_outside_owner','foreign_host_peer','built_entry','unsettled_acquisition']);
  const code=error instanceof Error&&codes.has(error.message)?error.message:'native_failure';
  console.error('Selected Comms dependency acquisition did not settle ('+code+'); reconcile its owned attempt before retrying.');process.exitCode=8;
});
