import { createHash, randomUUID } from 'node:crypto';
import { PalError } from './pal-provider.js';
const digest = value => createHash('sha256').update(value).digest('hex');
const closed = s => s.state === 'ended';
const safeId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const round = seconds => Math.max(30, Math.ceil(seconds / 6) * 6);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
export class PalService {
  constructor({ store, provider, config, audit, query, clock = Date.now, authorize = () => {} }) {
    Object.assign(this,{ store, provider, config, audit, query, clock, authorize });
    this.inflight = new Set();
  }
  status(owner) {
    const c=this.config(), s=this.store.read();
    const active=Object.values(s.sessions).find(v=>!closed(v));
    const conf=s.confirmation;
    return { enabled:c.enabled, configured:!!(c.key && c.palId && c.faceId),
      duration:120, maximumDuration:300, consumedSeconds:s.consumed,
      remainingSeconds:conf ? Math.max(0, Math.min(1200-s.consumed,conf.remaining)) : null,
      confirmedAt:conf?.at || null,
      confirmationRequired:!conf || conf.used || conf.owner!==digest(owner) || this.clock()<conf.at || this.clock()-conf.at>900000,
      active:active && active.owner === digest(owner) ? this.publicSession(active) : null,
      busy:!!active,
      reason:!c.enabled ? 'Enable the optional Pal component to start.' : !c.palId ? 'Prepare a stock-face PAL before starting.' : null };
  }
  publicSession(s) { return { id:s.id, state:s.state, createdAt:s.createdAt, deadline:s.deadline, duration:s.duration, reservedSeconds:s.reserved }; }
  owned(owner,id,state=this.store.read()) {
    this.authorize(owner);
    const session=state.sessions[id];
    if (!session || session.owner!==digest(owner)) throw new PalError('Pal session unavailable.',404);
    return session;
  }
  async record(event, sessionId) {
    if (!(await this.audit({event,sessionId}))) throw new PalError('GAIT is unavailable; Pal dispatch is paused.',503);
  }
  confirm(owner,{remainingSeconds,freePlanConfirmed,billingBoundConfirmed}) {
    this.authorize(owner);
    if (!Number.isSafeInteger(remainingSeconds) || remainingSeconds<0 || remainingSeconds>1200 || freePlanConfirmed!==true || billingBoundConfirmed!==true)
      throw new PalError('Confirm the current Free balance and bounded billing in Tavus first.',400);
    return this.store.update(s=>{
      if (Object.values(s.sessions).some(v=>!closed(v))) throw new PalError('Reconcile the existing conversation first.');
      s.confirmation={ remaining:Math.min(remainingSeconds,1200-s.consumed,s.confirmation?.remaining ?? 1200), at:this.clock(),owner:digest(owner),used:false };
      return {confirmed:true};
    });
  }
  async start(owner) {
    this.authorize(owner); const c=this.config();
    if (!c.enabled || !c.key || !c.palId || !c.faceId) throw new PalError('Pal is disabled or not configured.',503);
    await this.provider.validate(c.palId,c.faceId);
    await this.record('start-request', 'pending');
    this.authorize(owner);
    const session=this.store.update(s=>{
      if (Object.values(s.sessions).some(v=>!closed(v))) throw new PalError('One Pal conversation is already active or awaiting reconciliation.');
      const conf=s.confirmation;
      if (!conf || conf.used || conf.owner!==digest(owner) || this.clock()-conf.at>900000 || this.clock()<conf.at) throw new PalError('Confirm the current account balance before starting.');
      if (Object.keys(s.sessions).length>=100) throw new PalError('Pal experiment session limit reached.');
      const duration=120, reserved=round(duration+60);
      if (reserved>Math.min(1200-s.consumed,conf.remaining)) throw new PalError('Insufficient confirmed free allowance for a two-minute call plus cleanup reserve.');
      const item={id:randomUUID(),owner:digest(owner),state:'creating',createdAt:this.clock(),deadline:this.clock()+duration*1000,duration,reserved,turns:{}};
      s.sessions[item.id]=item; s.consumed+=reserved; conf.remaining-=reserved; conf.used=true;
      return structuredClone(item);
    });
    let reply;
    try {
      reply=await this.provider.create({palId:c.palId,faceId:c.faceId,name:`netclaw-pal-${session.id}`,duration:session.duration});
      if (!safeId(reply.conversation_id)) throw Error();
      // Save the provider identity before parsing join credentials, so cleanup is possible.
      this.store.update(s=>{s.sessions[session.id].conversationId=reply.conversation_id;});
      const url=new URL(reply.conversation_url);
      if (url.protocol!=='https:' || !url.hostname.endsWith('.daily.co') || url.username || url.password || url.search || url.hash || typeof reply.meeting_token!=='string' || reply.meeting_token.length>4096 || !reply.meeting_token) throw Error();
      this.authorize(owner);
      const active=this.store.update(s=>{
        const item=s.sessions[session.id];item.state='active';item.deadline=this.clock()+session.duration*1000;
        return this.publicSession(item);
      });
      return {...active,conversationId:reply.conversation_id,url:url.href,token:reply.meeting_token};
    } catch {
      this.store.update(s=>{s.sessions[session.id].state='unknown';});
      if (reply?.conversation_id && safeId(reply.conversation_id)) {
        try { await this.endInternal(session.id); } catch { /* reservation remains consumed */ }
      }
      throw new PalError('Conversation creation was not fully confirmed. Use Reconcile; do not create another call.',503);
    }
  }
  async endInternal(id) {
    const session=this.store.read().sessions[id];
    if (!session || closed(session)) return {ended:true};
    if (!session.conversationId) throw new PalError('Provider conversation identity is unknown. Reconcile first.');
    this.store.update(s=>{s.sessions[id].state='ending';});
    // Cleanup must remain possible when audit or enablement is unavailable.
    await this.provider.end(session.conversationId);
    this.store.update(s=>{s.sessions[id].state='ended';s.sessions[id].endedAt=this.clock();});
    await this.audit({event:'ended',sessionId:id});
    return {ended:true};
  }
  async end(owner,id) { this.owned(owner,id);return this.endInternal(id); }
  async reconcile(owner,id) {
    let session=this.owned(owner,id);
    if (closed(session)) return {ended:true};
    if (!session.conversationId) {
      const result=await this.provider.conversations();
      const matches=(result.data||[]).filter(x=>x.conversation_name===`netclaw-pal-${id}`);
      if(matches.length!==1 || !safeId(matches[0].conversation_id)) throw new PalError('Conversation remains ambiguous. Check Tavus account history; reservation is retained.');
      this.store.update(s=>{s.sessions[id].conversationId=matches[0].conversation_id;});
    }
    return this.endInternal(id);
  }
  async sweep() {
    const sessions=Object.values(this.store.read().sessions);
    for(const s of sessions) if(!closed(s) && s.conversationId && (s.deadline<=this.clock() || s.state==='ending' || s.state==='unknown')) {
      try {await this.endInternal(s.id);} catch { /* retry on next sweep; never release budget */ }
    }
  }
  async turn(owner,id,event) {
    if(!this.config().enabled) throw new PalError('Pal is disabled.',503);
    const session=this.owned(owner,id);
    if(session.state!=='active' || session.deadline<=this.clock()) throw new PalError('Pal conversation is no longer active.');
    if(!object(event) || Buffer.byteLength(JSON.stringify(event),'utf8')>3072 || event.message_type!=='conversation' || event.event_type!=='conversation.tool_call' || event.conversation_id!==session.conversationId) throw new PalError('Invalid Pal event.',400);
    const p=event.properties;
    if(!object(p) || p.name!=='netclaw_pal_query' || !safeId(p.tool_call_id)) throw new PalError('Unsupported Pal operation.',400);
    let args;try{args=typeof p.arguments==='string'?JSON.parse(p.arguments):p.arguments;}catch{throw new PalError('Invalid tool arguments.',400);}
    if(!object(args) || Object.keys(args).some(k=>k!=='question') || typeof args.question!=='string' || !args.question.trim() || args.question.length>1000) throw new PalError('A bounded question is required.',400);
    const hash=digest(args.question),key=p.tool_call_id;
    const existing=session.turns[key];
    if(existing) {
      if(existing.hash!==hash) throw new PalError('Conflicting replay.',409);
      return this.turnResult(session,key);
    }
    if(this.inflight.has(id)) throw new PalError('NetClaw is still answering the previous question.');
    this.inflight.add(id);
    try {
      await this.record('question-request',id);
      this.authorize(owner);
      this.store.update(s=>{
        const current=this.owned(owner,id,s);
        if(current.state!=='active' || current.deadline<=this.clock() || current.turns[key] || Object.values(current.turns).some(t=>t.state==='pending') || Object.keys(current.turns).length>=30) throw new PalError('Pal turn unavailable.');
        current.turns[key]={hash,state:'pending'};
      });
      let result;
      try {result=await this.query({question:args.question,sessionId:id});} catch {result={status:'unavailable'};}
      this.store.update(s=>{
        const t=s.sessions[id].turns[key];
        t.state=result?.status==='ok'?'complete':'unavailable';
        // Generated answers remain local until the operator approves the exact text.
        t.answer=t.state==='complete' && typeof result.answer==='string'?result.answer.slice(0,8000):'';
      });
      this.authorize(owner);
      return this.turnResult(this.owned(owner,id),key);
    } finally {this.inflight.delete(id);}
  }
  turnResult(session,key) {
    const t=session.turns[key];
    const text=t.state==='complete'?'NetClaw has answered. Please review the answer in your local panel.':t.state==='pending'?'NetClaw is still working.':'The restricted NetClaw companion is unavailable. No device action was taken.';
    const active=session.state==='active' && session.deadline>this.clock();
    return {callId:key,state:t.state,localAnswer:t.answer||'', event:active?{message_type:'conversation',event_type:'conversation.tool_result',conversation_id:session.conversationId,properties:{tool_call_id:key,output:text,status:'success'}}:null};
  }
  approveSpeech(owner,id,key) {
    if(!this.config().enabled) throw new PalError('Pal is disabled.',503);
    const s=this.owned(owner,id),t=s.turns[key];
    if(s.state!=='active' || s.deadline<=this.clock() || !t || t.state!=='complete' || !t.answer) throw new PalError('No active answer to speak.');
    // Approval releases the stored answer, never arbitrary replacement text from a caller.
    const event={message_type:'conversation',event_type:'conversation.echo',conversation_id:s.conversationId,properties:{modality:'text',text:t.answer}};
    if(Buffer.byteLength(JSON.stringify(event),'utf8')>3072) throw new PalError('Answer is too long for the speech channel. Read it locally.');
    return event;
  }
}
