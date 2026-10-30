/** Register one acquired plugin without enabling it or loading its runtime. */
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {APPROVED_PACKAGES} from './netclaw-comms-contract.mjs';

function read(file:string){
  if(fs.realpathSync(file)!==file)throw Error('alias');
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  try{
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.uid!==process.getuid!()||(stat.mode&0o077)||stat.size>4*1024*1024)throw Error('private_input');
    return JSON.parse(fs.readFileSync(fd,'utf8'));
  }finally{fs.closeSync(fd);}
}
function output(file:string,value:unknown){
  const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function hash(file:string){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

async function main(){
  process.umask(0o077);
  const home=process.env.OPENCLAW_STATE_DIR,channel=process.argv[2],mode=process.argv[3]??'register';
  if(!home||!path.isAbsolute(home)||fs.realpathSync(home)!==home||![3,4].includes(process.argv.length)||
     !['register','observe'].includes(mode)||
     !Object.hasOwn(APPROVED_PACKAGES,channel))throw Error('scope');
  const approved=APPROVED_PACKAGES[channel as keyof typeof APPROVED_PACKAGES];
  const owner=read(path.join(home,'.netclaw-setup-owner.json'));
  if(!owner.runId||!owner.installationId)throw Error('owner');
  const attempt=path.join(home,'.setup/comms',channel),receipt=path.join(attempt,'acquire-result.json');
  const acquired=read(receipt),request=read(path.join(attempt,'acquire-request.json'));
  const configFile=path.join(home,'openclaw.json'),config=read(configFile);
  if(mode==='register'&&!isDeepStrictEqual(config,request.config)||acquired.schema!==1||acquired.channel!==channel||
     acquired.pluginId!==approved.pluginId||acquired.package!==approved.package||acquired.version!==approved.version||acquired.integrity!==approved.integrity||
     acquired.integrity!==request.integrity||acquired.dependencies!==true||acquired.registered!==false)throw Error('receipt');
  const root=acquired.installPath,npmDir=path.join(attempt,'npm');
  if(typeof root!=='string'||!root.startsWith(npmDir+path.sep)||fs.realpathSync(root)!==root)throw Error('package_scope');
  const pkg=read(path.join(root,'package.json'));
  const lock=read(path.resolve(root,'../../..','package-lock.json'));
  if(pkg.name!==acquired.package||pkg.version!==acquired.version||
     lock.packages?.['node_modules/'+acquired.package]?.integrity!==acquired.integrity)throw Error('package_changed');
  const core=path.resolve(import.meta.dirname,'..');
  const peer=path.join(root,'node_modules/openclaw');
  if((fs.existsSync(peer)||pkg.peerDependencies?.openclaw)&&fs.realpathSync(peer)!==core||
     JSON.parse(fs.readFileSync(path.join(core,'package.json'),'utf8')).version!=='2026.7.1-2')throw Error('host_changed');
  const {getGlobalHookRunner}=await import('./plugins/hook-runner-global.js');
  if(getGlobalHookRunner()!==null)throw Error('active_runtime');
  const api=await import('./plugins/installed-plugin-index-records.js');
  const {buildNpmResolutionInstallFields}=await import('./plugins/installs.js');
  const options={env:process.env,stateDir:home,config};
  const indexPath=api.resolveInstalledPluginIndexRecordsStorePath(options);
  if(indexPath!==path.join(home,'state/openclaw.sqlite'))throw Error('index_scope');
  for(const directory of [home,path.join(home,'state')]){
    if(fs.existsSync(directory)){
      const info=fs.lstatSync(directory);
      if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==process.getuid!()||(info.mode&0o077))throw Error('index_scope');
    }
  }
  if(fs.existsSync(indexPath)&&fs.realpathSync(indexPath)!==indexPath)throw Error('index_scope');
  const current=await api.readPersistedInstalledPluginIndexInstallRecords(options)??{};
  const intentFile=path.join(attempt,'register-intent.json'),resultFile=path.join(attempt,'register-result.json');
  let intent:any;
  if(mode==='observe'){
    intent=read(intentFile);
    if(intent.schema!==1||intent.channel!==channel||intent.receiptHash!==hash(receipt)||
       !isDeepStrictEqual(current[approved.pluginId],intent.after?.[approved.pluginId]))throw Error('registration_changed');
  }else if(fs.existsSync(intentFile)){
    intent=read(intentFile);
    if(intent.schema!==1||intent.channel!==channel||intent.receiptHash!==hash(receipt)||
       !isDeepStrictEqual(intent.config,config))throw Error('registration_changed');
    // A native writer may have completed before the process died. Settle from
    // the exact record map; never issue that write again on an unknown result.
    if(!isDeepStrictEqual(current,intent.after))throw Error('registration_unknown');
  }else{
    if(Object.hasOwn(current,approved.pluginId))throw Error('registration_occupied');
    const after=api.recordPluginInstallInRecords(current,{pluginId:approved.pluginId,source:'npm',
      spec:acquired.package+'@'+acquired.version,installPath:root,version:acquired.version,
      ...buildNpmResolutionInstallFields(acquired.npmResolution)});
    intent={schema:1,channel,receiptHash:hash(receipt),config,before:current,after};
    output(intentFile,intent);
    if(!isDeepStrictEqual(await api.readPersistedInstalledPluginIndexInstallRecords(options)??{},current))throw Error('registration_changed');
    await api.writePersistedInstalledPluginIndexInstallRecords(after,options);
    if(!isDeepStrictEqual(await api.readPersistedInstalledPluginIndexInstallRecords(options),after))throw Error('registration_unknown');
  }
  if(!isDeepStrictEqual(read(configFile),config)||getGlobalHookRunner()!==null)throw Error('configuration_changed');
  // Snapshot inspection reads manifests and dependency metadata, not plugin
  // modules or adapters. Channel activation is a later reviewed effect.
  const {buildPluginSnapshotReport}=await import('./plugins/status.js');
  const snapshot=buildPluginSnapshotReport({config,onlyPluginIds:[approved.pluginId],env:process.env,
    workspaceDir:path.join(home,'workspace'),logger:{info:()=>{},warn:()=>{},error:()=>{},debug:()=>{}}});
  const selected=snapshot.plugins.filter(p=>p.id===approved.pluginId);
  if(selected.length!==1||selected[0].rootDir!==root||selected[0].dependencyStatus?.requiredInstalled!==true)throw Error('registration_unreadable');
  if(mode==='observe'){
    process.stdout.write(JSON.stringify({schema:1,channel,registered:true,dependencies:true,activated:false})+'\n');return;
  }
  const result={schema:1,channel,registered:true,configurationUnchanged:true,activated:false};
  if(fs.existsSync(resultFile)){
    if(!isDeepStrictEqual(read(resultFile),result))throw Error('registration_changed');
  }else output(resultFile,result);
  process.stdout.write(JSON.stringify(result)+'\n');
}
main().catch((error)=>{
  const codes=new Set(['alias','private_input','scope','owner','receipt','package_scope','package_changed','host_changed',
    'active_runtime','index_scope','registration_changed','registration_unknown','registration_occupied',
    'configuration_changed','registration_unreadable']);
  const code=error instanceof Error&&codes.has(error.message)?error.message:'native_failure';
  console.error('Selected Comms registration did not settle ('+code+'); reconcile its owned index before retrying.');process.exitCode=8;
});
