const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function routes(file, dependencies, globals={}){
 const handlers={},middleware=[];
 const router={use:h=>middleware.push(h)};
 for(const m of ['get','post','patch'])router[m]=(p,h)=>{handlers[m+' '+p]=h};
 vm.runInNewContext(fs.readFileSync(__dirname+'/src/routes/'+file,'utf8'),{
 require:n=>n==='express'?{Router:()=>router}:dependencies[n],module:{exports:{}},process:{env:{}},console,Date,AbortSignal,Promise,URLSearchParams,...globals,
 });
 return {handlers,middleware};
}
function response(){return {code:200,status(c){this.code=c;return this},json(b){this.body=b;return this}}}
test('case routes deny cross-site lookup and viewer mutation',async()=>{
 const {handlers,middleware}=routes('events.js',{'../db':{query:async(sql,args)=>({rows:args.includes('home')?[]:[{id:'other-case',site_id:'other'}]}),DbUnavailableError:class extends Error{},dbStatus:()=>({available:true})}});
 let r=response();await handlers['get /:id']({params:{id:'other-case'},site:'home'},r);assert.equal(r.code,404);
 r=response();middleware[0]({method:'PATCH',user:{role:'viewer'}},r,()=>assert.fail('viewer write passed'));assert.equal(r.code,403);
 r=response();await handlers['patch /:id']({params:{id:'other-case'},site:'home',body:{status:'resolved'}},r);assert.equal(r.code,404);
});
test('security aggregates structured logs and ranks observed sources',async()=>{
 const queries=[];
 const {handlers}=routes('security.js',{'../lib/config':{LOKI_URL:'http://logs',promqlLabelValue:s=>s}}, {
  fetch:async url=>{
   const q=new URL(url).searchParams.get('query');queries.push(q);
   const rows=q.startsWith('topk')?[{metric:{attributes_src_ip:'one'},value:[0,'2']},{metric:{attributes_src_ip:'two'},value:[0,'9']}]:[{value:[0,'11']}];
   return {ok:true,json:async()=>({status:'success',data:{result:rows}})};
  },
 });
 const r=response();await handlers['get /']({site:'home'},r);
 assert.equal(r.body.status,'active');assert.equal(r.body.topSources[0].ip,'two');
 assert.equal(r.body.intrusionDetection.status,'not_configured');
 assert.ok(queries.every(q=>q.includes('attributes_appname="filterlog"')&&q.includes('site="home"')));
});
test('security does not report zero attacks when logs are unavailable',async()=>{
 const {handlers}=routes('security.js',{'../lib/config':{LOKI_URL:'http://logs',promqlLabelValue:s=>s}}, {
  fetch:async()=>{throw new Error('offline')},
 });
 const r=response();await handlers['get /']({site:'home'},r);
 assert.equal(r.body.status,'unavailable');assert.equal(r.body.blockedConnections.lastHour,null);
});
test('Alertmanager failure reports unknown counts and degraded source',async()=>{
 const q={instantQuery:async()=>[{value:[0,'99']}],extractScalar:r=>Number(r[0].value[1]),queryAlertmanager:async()=>{throw Error('down')}};
 const {handlers}=routes('health.js',{'../lib/queryEngine':q,'../lib/config':{getSiteConfig:()=>({}),getPrimaryProvider:()=>null,getThresholdStatus:()=> 'healthy',promqlLabelValue:s=>s}});
 const r=response();await handlers['get /']({site:'home'},r);
 assert.equal(r.body.alertCount.firing,null);assert.equal(r.body.unavailable,true);assert.equal(r.body.sources.alertmanager,'unavailable');
});
