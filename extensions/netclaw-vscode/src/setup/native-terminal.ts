import {StringDecoder} from 'node:string_decoder';
import {canonical,hash} from './data';

export interface NativeTerminalView {write:(text:string)=>void;dispose:()=>void}
export type NativeTerminalHook=(binding:any,input:(text:string)=>void,cancel:()=>void,
  resize:(columns:number,rows:number)=>void)=>Promise<NativeTerminalView>;
type ActiveTerminal={requestId:string;planHash:string;view?:NativeTerminalView;decoder:StringDecoder;bytes:number};

/** Private engine socket only. Never route these bytes to events or the broker. */
export class NativeTerminalSession {
  private active?:ActiveTerminal;
  private ended=false;
  constructor(private plan:any,private hook:NativeTerminalHook|undefined,private send:(frame:any)=>void,private cancel:()=>void){}
  get busy(){return !!this.active;}
  accept(request:any):boolean{
    if(typeof request?.type!=='string'||!request.type.startsWith('native-terminal'))return false;
    if(this.ended||request.protocol!==1)throw Error('Invalid native terminal session.');
    if(request.type==='native-terminal'){
      const b=request.binding,c=this.plan.claws.find((claw:any)=>claw.id===b?.owner);
      const permitted=c&&(b.phase==='onboard'&&b.effectId===`${c.id}:onboard`||
        b.phase==='components'&&c.capabilities.components.some((id:string)=>b.effectId===`${c.id}:components:${id}`)||
        b.phase==='comms'&&c.channels?.some((channel:any)=>b.effectId===`${c.id}:comms:${channel.id}`));
      if(this.active||!this.hook||!permitted||b.planHash!==hash(canonical(this.plan))||
        !/^[a-f0-9]{48}$/.test(request.requestId)||Object.keys(request).sort().join(',')!=='binding,protocol,requestId,type'||
        Object.keys(b).sort().join(',')!=='effectId,owner,phase,planHash')throw Error('Unreviewed native terminal.');
      const active:ActiveTerminal={requestId:request.requestId,planHash:b.planHash,decoder:new StringDecoder('utf8'),bytes:0};
      this.active=active;
      const send=(type:string,extra:object={})=>{if(this.active===active&&!this.ended)this.send({protocol:1,type,requestId:active.requestId,planHash:active.planHash,...extra});};
      void this.hook(b,text=>{
        if(!active.view)return;
        const bytes=Buffer.from(text,'utf8');
        // Each frame is bounded; a paste cannot become an unbounded allocation.
        if(bytes.length>16384){this.cancel();return;}
        if(bytes.length)send('native-terminal-input',{data:bytes.toString('base64')});
      },()=>this.cancel(),(columns,rows)=>{
        if(!active.view)return;
        if(Number.isInteger(columns)&&Number.isInteger(rows)&&columns>0&&columns<=500&&rows>0&&rows<=300)
          send('native-terminal-resize',{columns,rows});
      }).then(view=>{
        if(this.ended||this.active!==active){view.dispose();return;}
        active.view=view;send('native-terminal-ready');
      }).catch(()=>this.cancel());
      return true;
    }
    const active=this.active;
    if(!active?.view||request.requestId!==active.requestId||request.planHash!==active.planHash)throw Error('Stale native terminal frame.');
    if(request.type==='native-terminal-output'){
      if(Object.keys(request).sort().join(',')!=='data,planHash,protocol,requestId,type'||typeof request.data!=='string'||request.data.length>21848)throw Error('Invalid terminal output.');
      const bytes=Buffer.from(request.data,'base64');
      active.bytes+=bytes.length;
      if(!bytes.length||bytes.toString('base64')!==request.data||bytes.length>16384||active.bytes>8*1024*1024)throw Error('Invalid terminal output.');
      active.view.write(active.decoder.write(bytes));
    }else if(request.type==='native-terminal-exit'){
      if(Object.keys(request).sort().join(',')!=='planHash,protocol,requestId,returncode,type'||!Number.isInteger(request.returncode)||request.returncode< -255||request.returncode>255)throw Error('Invalid terminal exit.');
      active.view.write(active.decoder.end());this.active=undefined;active.view.dispose();
    }else throw Error('Unexpected native terminal frame.');
    return true;
  }
  dispose(){this.ended=true;const active=this.active;this.active=undefined;active?.view?.dispose();}
}
