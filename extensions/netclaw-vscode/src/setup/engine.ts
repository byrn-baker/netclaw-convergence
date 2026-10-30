import fs from 'node:fs';
import path from 'node:path';
import {spawn,ChildProcess} from 'node:child_process';
import {Duplex} from 'node:stream';
import {canonical,strictJson,hash} from './data';
import {inspectSource} from './source';
import {NativeTerminalHook,NativeTerminalSession} from './native-terminal';

export interface EngineHooks {
  review:(binding:any)=>Promise<boolean>;
  secret:(owner:string,key:string)=>Promise<string|undefined>;
  event:(event:any)=>void;
  choice?:(binding:any,title:string,choices:string[])=>Promise<string|undefined>;
  destination?:(binding:any)=>Promise<string|undefined>;
  terminal?:NativeTerminalHook;
}
export function lines(handler:(value:any)=>void,limit=65536){
  let bytes=Buffer.alloc(0);
  return (chunk:Buffer)=>{
    bytes=Buffer.concat([bytes,chunk]);
    while(true){const at=bytes.indexOf(10);if(at<0)break;if(at>limit)throw Error('Engine event exceeded its limit.');
      handler(strictJson(bytes.subarray(0,at),limit));bytes=bytes.subarray(at+1);}
    if(bytes.length>limit)throw Error('Engine event exceeded its limit.');
  };
}
export function documents(handler:(value:any)=>void){
  let pending:{id:string;bytes:number;digest:string;parts:Buffer[];received:number}|undefined;
  return lines(value=>{
    if(value.type==='document-start'){
      if(pending||value.protocol!==1||!/^\w{32}$/.test(value.id)||!Number.isSafeInteger(value.bytes)||value.bytes<65536||value.bytes>8*1024*1024||!/^[a-f0-9]{64}$/.test(value.sha256))throw Error('Invalid engine document.');
      pending={id:value.id,bytes:value.bytes,digest:value.sha256,parts:[],received:0};return;
    }
    if(pending){
      if(value.id!==pending.id||value.protocol!==1)throw Error('Engine document binding changed.');
      if(value.type==='document-part'){
        if(value.index!==pending.parts.length||typeof value.data!=='string'||value.data.length>43692||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.data))throw Error('Invalid engine document part.');
        const part=Buffer.from(value.data,'base64');pending.received+=part.length;
        if(!part.length||pending.received>pending.bytes||pending.parts.length>=256)throw Error('Engine document exceeded its limit.');
        pending.parts.push(part);return;
      }
      if(value.type!=='document-end'||pending.received!==pending.bytes)throw Error('Incomplete engine document.');
      const data=Buffer.concat(pending.parts);if(hash(data)!==pending.digest)throw Error('Engine document changed.');
      pending=undefined;handler(strictJson(data,8*1024*1024));return;
    }
    if(value.type==='document-end'||value.type==='document-part')throw Error('Unexpected engine document part.');
    handler(value);
  });
}
export class SetupEngine {
  private child?:ChildProcess;
  private heartbeat?:NodeJS.Timeout;
  constructor(readonly python:string,readonly source:string){}
  async discover(provider:'ollama'|'lm-studio',endpoint:string,destination:string):Promise<any>{
    return this.observation('discover-models',['--provider',provider,'--endpoint',endpoint,'--destination',destination]);
  }
  async advise(planFile:string,answers:Record<string,string>):Promise<any>{
    return this.observation('advise',['--plan',planFile,'--advisor-answers',canonical(answers)]);
  }
  async read(operation:'validate'|'explain'|'status'|'report'|'observe-host'|'advise'|'cleanup-preview'|'connections',planFile?:string,runId?:string):Promise<any>{
    const extra=[];if(planFile)extra.push('--plan',planFile);if(runId)extra.push('--run-id',runId);
    return this.observation(operation,extra);
  }
  private async observation(operation:string,extra:string[]):Promise<any>{
    await inspectSource(this.source);
    const args=[path.join(this.source,'scripts/setup-engine.py'),operation,...extra];
    return new Promise((resolve,reject)=>{
      const child=spawn(this.python,args,{cwd:this.source,stdio:['ignore','pipe','ignore'],env:this.environment()});
      let result:any;const timer=setTimeout(()=>{child.kill();reject(Error('Setup observation timed out.'));},30000);
      const receive=documents(value=>{result=value;});
      child.stdout.on('data',chunk=>{try{receive(chunk);}catch{child.kill();reject(Error('Invalid setup observation.'));}});
      child.once('error',()=>{clearTimeout(timer);reject(Error('Python setup engine could not start.'));});
      child.once('exit',code=>{clearTimeout(timer);result&&[0,2].includes(code??-1)?resolve(result):reject(Error('Setup observation failed.'));});
    });
  }
  private environment():NodeJS.ProcessEnv{
    const env:NodeJS.ProcessEnv={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'en_US.UTF-8',PYTHONNOUSERSITE:'1'};
    if(process.env.WSL_DISTRO_NAME)env.WSL_DISTRO_NAME=process.env.WSL_DISTRO_NAME;
    return env;
  }
  async execute(planFile:string,hooks:EngineHooks,runId?:string,options?:{operation:'verify'|'export'|'cleanup';destination?:string;detailed?:boolean}):Promise<any>{
    if(this.child)throw Error('This setup window already owns an active run.');
    const inspected=await inspectSource(this.source);
    const plan=strictJson(fs.readFileSync(planFile));
    if(plan.source.path!==this.source||options?.operation!=='export'&&['commit','treeHash','dirty'].some(k=>(inspected as any)[k]!==plan.source[k]))throw Error('Source changed. Review the updated plan before execution.');
    const args=[path.join(this.source,'scripts/setup-engine.py'),options?.operation||(runId?'resume':'apply'),'--plan',planFile,'--native'];
    if(runId)args.push('--run-id',runId);
    if(options?.destination)args.push('--destination',options.destination);
    if(options?.detailed)args.push('--detailed');
    return new Promise((resolve,reject)=>{
      const child=spawn(this.python,args,{cwd:this.source,stdio:['pipe','pipe','ignore','pipe'],env:this.environment()});this.child=child;
      const native=child.stdio[3] as Duplex;let result:any,reviewing=false,secretPending=false,failure:string|undefined;
      const send=(value:any)=>{if(!child.stdin?.destroyed)child.stdin?.write(canonical(value)+'\n');};
      this.heartbeat=setInterval(()=>send({protocol:1,type:'heartbeat'}),5000);send({protocol:1,type:'heartbeat'});
      const stop=()=>{this.pause();};
      const terminal=new NativeTerminalSession(plan,hooks.terminal,frame=>{if(!native.destroyed)native.write(canonical(frame)+'\n');},stop);
      const receive=documents(event=>{
        if(event.protocol!==1&&event.valid===undefined)throw Error('Unknown engine protocol.');
        if(event.type==='secret-request'){
          if(secretPending||terminal.busy||typeof event.owner!=='string'||typeof event.key!=='string'||typeof event.requestId!=='string')throw Error('Invalid credential request.');
          const owner=plan.claws.find((c:any)=>c.id===event.owner),setting=owner?.settings?.[event.key];
          if(!setting||setting.kind!=='secret'||setting.source!=='prompt')throw Error('Unreviewed credential request.');
          secretPending=true;
          void hooks.secret(event.owner,event.key).then(value=>{
            if(value===undefined){stop();return;}
            send({...event,type:'secret',value});
          }).catch(stop).finally(()=>{secretPending=false;});
        }else{
          if(event.type==='error'&&event.code==='resource_busy')
            failure='Another setup run is using this source or target. Wait for it to finish, then review and try again.';
          if(event.type==='error'&&event.code==='production_controls_unverified'&&Array.isArray(event.blockedControls)){
            const controls=event.blockedControls.filter((c:any)=>(c.owner==='host'||plan.claws.some((claw:any)=>claw.id===c.owner))&&/^[a-z][a-z0-9-]{0,63}$/.test(c.control)&&['unverified','unsupported'].includes(c.state));
            failure='Production setup stopped. '+controls.map((c:any)=>`${c.owner}: ${c.control} (${c.state})`).join('; ')+'. No testing-mode downgrade was made.';
          }
          if(event.state&&(event.effects||['export','cleanup'].includes(event.operation)))result=event;
          hooks.event(event);
        }
      });
      const nativeReceive=lines(request=>{
        if(request.type?.startsWith('native-terminal')){
          if(reviewing||secretPending)throw Error('Concurrent native input.');
          terminal.accept(request);return;
        }
        if(terminal.busy)throw Error('Native input overlapped an interactive step.');
        if(request.type==='native-destination'){
          const b=request.binding;
          if(reviewing||request.protocol!==1||typeof request.requestId!=='string'||b?.operation!=='channel-destination'||b.planHash!==hash(canonical(plan))||
            !plan.verification.channelTests.some((t:any)=>t.owner===b.owner&&t.channel===b.channel&&t.destinationRef===b.destinationRef))throw Error('Invalid channel destination request.');
          reviewing=true;
          void (hooks.destination?.(b)||Promise.resolve(undefined)).then(destination=>{
            if(!native.destroyed)native.write(canonical({protocol:1,type:'native-destination-answer',requestId:request.requestId,planHash:b.planHash,destination:destination??null})+'\n');
          }).catch(stop).finally(()=>{reviewing=false;});return;
        }
        if(request.type==='native-choice'){
          if(reviewing||request.protocol!==1||typeof request.requestId!=='string'||request.binding?.planHash!==hash(canonical(plan))||
            !plan.claws.some((c:any)=>c.id===request.binding?.owner)||typeof request.title!=='string'||request.title.length>200||
            !Array.isArray(request.choices)||request.choices.length>512||request.choices.some((c:any)=>typeof c!=='string'||c.length>128||/[\r\n\0]/.test(c)))throw Error('Invalid native selection.');
          reviewing=true;
          void (hooks.choice?.(request.binding,request.title,request.choices)||Promise.resolve(undefined)).then(choice=>{
            if(!native.destroyed)native.write(canonical({protocol:1,type:'native-choice-answer',requestId:request.requestId,planHash:request.binding.planHash,choice:choice??null})+'\n');
          }).catch(stop).finally(()=>{reviewing=false;});return;
        }
        if(reviewing||request.protocol!==1||request.type!=='native-review'||typeof request.requestId!=='string')throw Error('Invalid native review request.');
        reviewing=true;
        void hooks.review(request.binding).then(approved=>{
          if(!native.destroyed)native.write(canonical({protocol:1,type:'native-review-answer',requestId:request.requestId,
            planHash:request.binding.planHash,approved})+'\n');
        }).catch(stop).finally(()=>{reviewing=false;});
      });
      child.stdout?.on('data',chunk=>{try{receive(chunk);}catch{stop();reject(Error('Engine output was invalid; the run must be inspected before resuming.'));}});
      native.on('data',chunk=>{try{nativeReceive(chunk);}catch{stop();reject(Error('Native review channel was invalid.'));}});
      const finish=()=>{terminal.dispose();if(this.heartbeat)clearInterval(this.heartbeat);this.heartbeat=undefined;this.child=undefined;};
      child.once('error',()=>{finish();reject(Error('Setup engine could not start.'));});
      child.once('exit',code=>{finish();result?resolve(result):reject(Error(failure||(code===3?'Setup review was cancelled.':'Setup stopped before a settled report. Inspect this run before resuming.')));});
    });
  }
  pause(){
    if(this.child?.stdin&&!this.child.stdin.destroyed){this.child.stdin.write(canonical({protocol:1,type:'pause'})+'\n');this.child.stdin.end();}
    if(this.heartbeat)clearInterval(this.heartbeat);this.heartbeat=undefined;
  }
  dispose(){this.pause();}
}
