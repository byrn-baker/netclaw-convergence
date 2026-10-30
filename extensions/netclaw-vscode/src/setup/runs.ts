import path from 'node:path';
import {canonical,hash,readData} from './data';
import {LocalState} from '../state/local';

export interface RunReference {runId:string;source:string;planFile:string;planHash:string;state:string}
const states=new Set(['applying','verifying','observing','pending','running','paused','pause_requested','completed','unknown','failed','configuration_required','unverified','verified','skipped']);
export class SetupRuns {
  private queue:Promise<void>=Promise.resolve();
  private sequence=0;
  constructor(private local:LocalState){}
  saved():RunReference|undefined{
    const value=this.local.get<any>('setup-run',undefined);if(!value)return;
    if(!/^run-[a-f0-9]{32}$/.test(value.runId)||! /^[a-f0-9]{64}$/.test(value.planHash)||
      ![value.source,value.planFile].every(p=>typeof p==='string'&&path.isAbsolute(p))||!states.has(value.state))throw Error('Saved setup run metadata is invalid.');
    return {runId:value.runId,source:value.source,planFile:value.planFile,planHash:value.planHash,
      state:['applying','running','verifying','observing','pause_requested'].includes(value.state)?'unknown':value.state};
  }
  plan(reference:RunReference){
    const plan=readData(reference.planFile);
    if(hash(canonical(plan))!==reference.planHash||plan.source?.path!==reference.source)throw Error('Saved run plan changed. Inspect its journal before resuming.');
    return plan;
  }
  begin(){this.sequence=0;}
  event(event:any,plan:any,planFile:string):Promise<void>{
    if(!event||event.protocol!==1||!/^run-[a-f0-9]{32}$/.test(event.runId)||!states.has(event.state))return Promise.resolve();
    if(event.sequence!==undefined){
      if(!Number.isSafeInteger(event.sequence)||event.sequence<=this.sequence)throw Error('Setup progress is out of order.');
      this.sequence=event.sequence;
    }
    const state=event.phase&&event.phase!=='run'?(event.phase==='verification'?'verifying':'applying'):event.state;
    const reference:RunReference={runId:event.runId,source:plan.source.path,planFile,planHash:hash(canonical(plan)),state};
    this.queue=this.queue.then(()=>this.local.update('setup-run',reference));return this.queue;
  }
  settled(){return this.queue;}
}
