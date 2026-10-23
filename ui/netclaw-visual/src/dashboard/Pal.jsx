import React, { useEffect, useRef, useState } from 'react';

async function api(route,body) {
  const response=await fetch('/api/pal'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  const result=await response.json();
  if(!response.ok) throw Error(result.error || 'Pal is unavailable.');
  return result;
}
export default function Pal({active,preview=false}) {
  const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[joined,setJoined]=useState(false);
  const [turns,setTurns]=useState([]),[seconds,setSeconds]=useState(0),[balance,setBalance]=useState(''),[confirmed,setConfirmed]=useState(false);
  const [icon,setIcon]=useState(()=>{try{const s=localStorage.getItem('nc-pal-icon-v1');return /^data:image\/(png|jpeg);base64,/.test(s||'') && s.length<350000?s:'';}catch{return '';}});
  const call=useRef(null),session=useRef(null),video=useRef(null),audio=useRef(null),stopping=useRef(false),activeRef=useRef(active);
  activeRef.current=active;
  const refresh=async()=>{if(!preview)setStatus(await api('/status'));};
  async function stop() {
    if(stopping.current || (!session.current && !call.current)) return;
    stopping.current=true; const saved=session.current;session.current=null;setJoined(false);
    const current=call.current;call.current=null;
    try {
      // End provider conversation independently of Daily leave/destroy success.
      await Promise.allSettled([current?.destroy(), saved?api(`/sessions/${saved.id}/end`,{}):Promise.resolve()]).then(results=>{
        if(results.some(r=>r.status==='rejected')) throw Error('Call cleanup needs reconciliation. Use Reconcile before starting again.');
      });
    } catch(e){setError(e.message);}
    finally{stopping.current=false;refresh().catch(()=>{});}
  }
  useEffect(()=>{
    if(preview || !active){if(!active)stop();return;}
    let disposed=false;
    (async()=>{
      const response=await fetch('/api/hud/session',{method:'POST'});
      if(!response.ok)throw Error('A local HUD session is required.');
      const value=await api('/status');if(!disposed)setStatus(value);
    })().catch(()=>{if(!disposed)setError('Pal status is unavailable.');});
    return ()=>{disposed=true;};
  },[active,preview]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const current=session.current;
      if(current){const left=Math.max(0,Math.ceil((current.deadline-Date.now())/1000));setSeconds(left);if(!left)stop();}
    },1000);
    const leave=()=>{
      const current=session.current;
      if(current) navigator.sendBeacon?.(`/api/pal/sessions/${current.id}/end`,new Blob(['{}'],{type:'application/json'}));
    };
    window.addEventListener('pagehide',leave);
    return ()=>{clearInterval(timer);window.removeEventListener('pagehide',leave);leave();call.current?.destroy().catch(()=>{});};
  },[]);
  async function start() {
    setBusy(true);setError('');setTurns([]);
    try {
      const {default:Daily}=await import('@daily-co/daily-js');
      if(!activeRef.current) return;
      const created=await api('/sessions',{});session.current=created;
      if(!activeRef.current){await stop();return;}
      const current=Daily.createCallObject({videoSource:false,startVideoOff:true});call.current=current;
      const sync=()=>{
        const remote=Object.values(current.participants()).find(p=>!p.local);
        for(const [ref,kind] of [[video,'video'],[audio,'audio']]){
          const track=remote?.tracks?.[kind]?.persistentTrack;
          if(ref.current){ref.current.srcObject=track?new MediaStream([track]):null;ref.current.play().catch(()=>{});}
        }
      };
      current.on('participant-updated',sync).on('participant-joined',sync).on('track-started',sync);
      current.on('left-meeting',()=>{if(session.current)stop();});
      current.on('error',()=>{setError('Video connection failed. Ending the call.');stop();});
      current.on('app-message',async message=>{
        const currentSession=session.current;
        const event=message.data;
        if(!currentSession || event?.event_type!=='conversation.tool_call' || message.fromId===current.participants().local?.session_id)return;
        try {
          const result=await api(`/sessions/${currentSession.id}/turns`,event);
          setTurns(old=>[...old.filter(t=>t.callId!==result.callId),result]);
          if(session.current?.id===currentSession.id && result.event)current.sendAppMessage(result.event,message.fromId);
        }catch(e){setError(e.message);}
      });
      await current.join({url:created.url,token:created.token,userName:'NetClaw operator',startVideoOff:true});
      if(session.current?.id!==created.id){await current.destroy();return;}
      setJoined(true);setSeconds(Math.max(0,Math.ceil((created.deadline-Date.now())/1000)));sync();
    }catch(e){setError(e.message||'Pal could not start.');await stop();}
    finally{setBusy(false);refresh().catch(()=>{});}
  }
  async function saveAllowance(e) {
    e.preventDefault();setBusy(true);setError('');
    try{await api('/allowance',{remainingSeconds:Number(balance),freePlanConfirmed:confirmed,billingBoundConfirmed:confirmed});await refresh();setConfirmed(false);}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function speak(turn) {
    const current=session.current;if(!current)return;
    try{const event=await api(`/sessions/${current.id}/speech/${turn.callId}`,{});if(session.current?.id===current.id)call.current?.sendAppMessage(event);}catch(e){setError(e.message);}
  }
  function selectIcon(e) {
    const file=e.target.files?.[0];
    if(!file)return;
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>250000){setError('Choose a PNG or JPG under 250 KB for the local icon.');return;}
    const reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('nc-pal-icon-v1',reader.result);setIcon(reader.result);}catch{setError('Local icon storage is unavailable.');}};reader.readAsDataURL(file);
  }
  return <section className="panel pal-panel" aria-label="NetClaw Pal">
    <div className="section-heading"><div><span className="eyebrow">VOICE COMPANION · FREE PLAN</span><h2>Talk with NetClaw</h2></div><span className="badge">{joined?'In conversation':preview?'Preview':status?.enabled?'Ready for setup':'Disabled'}</span></div>
    <div className="pal-layout"><div className="pal-stage">
      <video ref={video} autoPlay playsInline muted aria-label="Tavus stock face" hidden={!joined}/><audio ref={audio} autoPlay/>
      {!joined&&<div className="pal-placeholder">{icon?<img src={icon} alt="Your local Pal icon"/>:<span aria-hidden="true">☺</span>}<h3>Your NetClaw, with a voice</h3><p>A stock Tavus face appears when you start a call.</p></div>}
      <div className="pal-controls"><button className="primary" onClick={start} disabled={preview||busy||joined||!status?.enabled||!status?.configured||status?.confirmationRequired||status?.busy}>Start two-minute call</button><button onClick={stop} disabled={!session.current}>End call</button>{joined&&<strong aria-live="off">{seconds}s remaining</strong>}</div>
    </div><div className="pal-details"><p>Your microphone audio goes to Tavus. Camera, screen sharing and recording are off. Keep credentials and private network details out of spoken questions.</p><p>The restricted NetClaw companion explains concepts. It cannot read or change devices. Answers stay in this panel until you choose to speak them.</p><p><strong>Free allowance:</strong> {status?.remainingSeconds==null?'Not confirmed':`${status.remainingSeconds} seconds conservatively remaining`}. One call at a time; no paid upgrades.</p>{status?.reason&&<p role="status">{status.reason}</p>}
      {status?.busy&&!joined&&<button onClick={async()=>{try{if(status.active)await api(`/sessions/${status.active.id}/reconcile`,{});else throw Error('Another local session owns the call.');await refresh();}catch(e){setError(e.message);}}}>Reconcile previous call</button>}
      <details><summary>Confirm Free allowance</summary><p>Check your Tavus account first. Each two-minute call reserves three minutes including cleanup. The estimate is conservative and does not refresh automatically.</p><form onSubmit={saveAllowance}><label>Remaining seconds in Tavus (maximum 1200)<input type="number" min="0" max="1200" step="1" value={balance} onChange={e=>setBalance(e.target.value)} required/></label><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I checked that this is the Free plan, the balance is current, and provider billing is bounded by the call limit plus the one-minute reserve. I will not use the account elsewhere during this call.</label><button disabled={preview||busy||!confirmed}>Save current allowance</button></form></details>
      <details><summary>Use your own local icon</summary><p>Your smiley or lobster can be this panel's icon. It stays in this browser; it does not replace the Tavus stock video face.</p><input aria-label="Local Pal icon" type="file" accept="image/png,image/jpeg" onChange={selectIcon}/></details>
    </div></div>
    {error&&<p role="alert" className="notice">{error}</p>}
    <div className="pal-answers" aria-live="polite">{turns.map(turn=><article key={turn.callId}><h3>{turn.state==='complete'?'NetClaw answer':'NetClaw status'}</h3><p className="pal-answer">{turn.localAnswer||'The restricted companion is unavailable or still working.'}</p>{turn.localAnswer&&<><p className="muted">Choosing Speak sends the exact answer above to Tavus.</p><button disabled={!joined} onClick={()=>speak(turn)}>Speak this answer</button></>}</article>)}</div>
  </section>;
}
