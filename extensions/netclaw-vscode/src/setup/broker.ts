import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {canonical,strictJson,readData,realParents} from './data';
import {setupInput} from '../assistants/setup';

type Registration={schema:1;sessionId:string;registrationId:string;host:string;socket:string;expiresAt:number;token:string;enabled:boolean};
const random=()=>randomBytes(16).toString('hex');
const fail=()=>Error('broker_unavailable');
export class SetupBroker {
  private server?:net.Server;
  private clients=new Set<net.Socket>();
  private seen=new Set<string>();
  private registration?:Registration;
  private directory?:string;
  private file?:string;
  private busy=false;
  constructor(private dispatch:(operation:string,params:any)=>Promise<any>){}
  async start(root:string,host:string){
    if(this.server)throw fail();realParents(root);
    fs.mkdirSync(root,{recursive:true,mode:0o700});
    this.directory=fs.mkdtempSync(path.join(root,'nc-'));fs.chmodSync(this.directory,0o700);
    const socket=path.join(this.directory,'s');if(Buffer.byteLength(socket)>100)throw Error('broker_path_too_long');
    const registration:Registration={schema:1,sessionId:random(),registrationId:random(),host,socket,expiresAt:Date.now()+8*3600*1000,token:randomBytes(32).toString('hex'),enabled:true};
    this.registration=registration;
    this.server=net.createServer(client=>{
      if(this.clients.size>=8){client.destroy();return;}this.clients.add(client);client.setTimeout(30000,()=>client.destroy());
      let bytes=Buffer.alloc(0),received=false;
      client.on('error',()=>{});client.once('close',()=>this.clients.delete(client));
      client.on('data',chunk=>{
        if(received){client.destroy();return;}bytes=Buffer.concat([bytes,chunk]);if(bytes.length>1024*1024){client.destroy();return;}
        const at=bytes.indexOf(10);if(at<0)return;received=true;
        void (async()=>{
          try{
            if(at!==bytes.length-1)throw fail();const value=strictJson(bytes.subarray(0,at));bytes=Buffer.alloc(0);
            const allowed=['protocol','registrationId','sessionId','requestId','token','operation','params'];
            if(!value||Object.keys(value).length!==allowed.length||Object.keys(value).some(k=>!allowed.includes(k))||value.protocol!==1||value.registrationId!==registration.registrationId||value.sessionId!==registration.sessionId||typeof value.requestId!=='string'||!/^[a-f0-9]{32}$/.test(value.requestId)||typeof value.token!=='string'||!/^[a-f0-9]{64}$/.test(value.token)||!timingSafeEqual(Buffer.from(value.token,'hex'),Buffer.from(registration.token,'hex'))||!registration.enabled||Date.now()>registration.expiresAt||this.seen.has(value.requestId)||this.seen.size>=4096)throw fail();
            const params=setupInput(value.operation,value.params);this.seen.add(value.requestId);
            if(this.busy)throw Error('review_pending');this.busy=true;
            try{
              const result=await this.dispatch(value.operation,params),data=canonical({ok:true,result});
              if(Buffer.byteLength(data)>1024*1024)throw fail();client.end(data+'\n');
            }finally{this.busy=false;}
          }catch{client.end('{"ok":false,"code":"request_refused"}\n');}
        })();
      });
    });
    await new Promise<void>((resolve,reject)=>{this.server!.once('error',reject);this.server!.listen(socket,()=>resolve());});
    fs.chmodSync(socket,0o600);this.file=path.join(this.directory,'registration.json');
    fs.writeFileSync(this.file,canonical(registration)+'\n',{mode:0o600,flag:'wx'});return this.file;
  }
  dispose(){
    if(this.registration)this.registration.enabled=false;
    for(const client of this.clients)client.destroy();this.clients.clear();this.server?.close();this.server=undefined;
    if(this.file){try{fs.unlinkSync(this.file);}catch{}}
    if(this.directory){try{fs.rmdirSync(this.directory);}catch{}}
    this.seen.clear();
  }
}

export function readSetupRegistration(file:string):Registration{
  realParents(file);const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.uid!==process.getuid?.()||(stat.mode&0o077)||stat.nlink!==1)throw fail();
  const r=readData(file,16384);
  if(r.schema!==1||r.enabled!==true||!Number.isSafeInteger(r.expiresAt)||Date.now()>r.expiresAt||r.expiresAt>Date.now()+8*3600*1000||!/^[a-f0-9]{64}$/.test(r.token)||!/^[a-f0-9]{32}$/.test(r.sessionId)||!/^[a-f0-9]{32}$/.test(r.registrationId)||r.socket!==path.join(path.dirname(file),'s')||Buffer.byteLength(r.socket)>100)throw fail();
  const socket=fs.lstatSync(r.socket),dir=fs.lstatSync(path.dirname(file));
  if(!socket.isSocket()||socket.uid!==process.getuid?.()||(socket.mode&0o077)||(dir.mode&0o077))throw fail();return r;
}
export async function brokerCall(file:string,operation:string,params:unknown):Promise<any>{
  setupInput(operation,params);const r=readSetupRegistration(file);
  return new Promise((resolve,reject)=>{
    const socket=net.connect(r.socket);let bytes=Buffer.alloc(0),settled=false;
    socket.setTimeout(30000,()=>socket.destroy(fail()));socket.once('error',()=>reject(fail()));
    socket.once('connect',()=>socket.write(canonical({protocol:1,registrationId:r.registrationId,sessionId:r.sessionId,requestId:random(),token:r.token,operation,params})+'\n'));
    socket.on('data',chunk=>{bytes=Buffer.concat([bytes,chunk]);if(bytes.length>1024*1024)socket.destroy(fail());});
    socket.once('end',()=>{try{const value=strictJson(bytes);if(value.ok!==true)throw fail();settled=true;resolve(value.result);}catch{reject(fail());}});
    socket.once('close',()=>{if(!settled)reject(fail());});
  });
}
