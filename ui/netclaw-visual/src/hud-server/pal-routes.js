import { cookieFrom } from './bindings.js';
import { PalService } from './pal-service.js';
import { PalStore } from './pal-store.js';
import { tavusClient } from './pal-provider.js';
import { palRuntime } from './pal-runtime.js';
import path from 'node:path';

export function mountPal(app,{root,home,bindings,getEnv,service:provided}) {
  const config=()=>{
    const env=getEnv();
    return {enabled:env.NETCLAW_PAL_ENABLED==='true',key:env.TAVUS_API_KEY,palId:env.TAVUS_PAL_ID,faceId:env.TAVUS_FACE_ID};
  };
  // Credentials are resolved per request; no API key enters browser payloads.
  const provider=new Proxy({}, {get:(_,method)=>(...args)=>tavusClient({key:config().key})[method](...args)});
  const runtime=palRuntime(root,home);
  const service=provided || new PalService({store:new PalStore(path.join(home,'netclaw-pal')),provider,config,...runtime,authorize:owner=>bindings.read(owner)});
  const route=fn=>async(req,res)=>{
    res.set('Cache-Control','no-store');
    const owner=cookieFrom(req);
    try{bindings.read(owner);}catch{return res.status(401).json({error:'Authentication required.'});}
    try{res.json(await fn(req,owner));}
    catch(e){res.status(e.status||503).json({error:e.status?e.message:'Pal is unavailable. No automatic retry was performed.'});}
  };
  app.get('/api/pal/status',route((req,owner)=>service.status(owner)));
  app.post('/api/pal/allowance',route((req,owner)=>service.confirm(owner,req.body||{})));
  app.post('/api/pal/sessions',route((req,owner)=>service.start(owner)));
  app.post('/api/pal/sessions/:id/end',route((req,owner)=>service.end(owner,req.params.id)));
  app.post('/api/pal/sessions/:id/reconcile',route((req,owner)=>service.reconcile(owner,req.params.id)));
  app.post('/api/pal/sessions/:id/turns',route((req,owner)=>service.turn(owner,req.params.id,req.body)));
  app.post('/api/pal/sessions/:id/speech/:callId',route(async(req,owner)=>{
    service.owned(owner,req.params.id);
    await service.record('speech-approved',req.params.id);
    return service.approveSpeech(owner,req.params.id,req.params.callId);
  }));
  const timer=setInterval(()=>service.sweep().catch(()=>{}),5000);timer.unref();
  return ()=>clearInterval(timer);
}
