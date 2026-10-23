import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import PalAvatar from './PalAvatar.jsx';
import { LocalPalAudio, PAL_PROFILES, safePalId, localReplySpeech, readPalPreferences, PAL_PREFERENCES_KEY, replyClips, MAX_SPOKEN_REPLY } from './local-pal-audio.js';

export default forwardRef(function LocalPal({active=true,preview=false,thinking=false,reply=null,latestReply='',conversationId},ref) {
  const [avatar,setAvatar]=useState(()=>{try{return safePalId(localStorage.getItem('nc-pal-avatar-v1'));}catch{return 'john';}});
  const [status,setStatus]=useState(null),[error,setError]=useState(''),[phase,setPhase]=useState('idle');
  const [progress,setProgress]=useState({index:0,total:0});
  const [enabled,setEnabled]=useState(false),[preferences,setPreferences]=useState(()=>{try{return readPalPreferences(window.sessionStorage);}catch{return readPalPreferences();}});
  const {mode,rate,volume}=preferences;
  useEffect(()=>{try{sessionStorage.setItem(PAL_PREFERENCES_KEY,JSON.stringify(preferences));}catch{}},[preferences]);
  const player=useRef(null),seen=useRef(reply?.id),current=useRef({active});current.current={active};
  if(!player.current)player.current=new LocalPalAudio({onState:setPhase,onProgress:setProgress,onError:e=>setError(e.message||'Local voice could not finish.')});
  useEffect(()=>{player.current.setVolume(volume);},[volume]);
  useEffect(()=>{
    if(preview)return;
    const controller=new AbortController();
    (async()=>{
      const session=await fetch('/api/hud/session',{method:'POST',credentials:'same-origin',signal:controller.signal});
      if(!session.ok)throw Error('A private HUD session is required for local speech.');
      const response=await fetch('/api/pal/local/status',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('Local voice status is unavailable.');
      const value=await response.json();if(!controller.signal.aborted)setStatus(value);
    })().catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return()=>controller.abort();
  },[preview]);
  useEffect(()=>{
    const silence=()=>{if(document.hidden)player.current.stop();};
    document.addEventListener('visibilitychange',silence);
    return()=>{document.removeEventListener('visibilitychange',silence);current.current.active=false;player.current.dispose();};
  },[]);
  useEffect(()=>{if(!active || thinking)player.current.stop();},[active,thinking]);
  useEffect(()=>{player.current.stop();setError('');},[conversationId]);
  useEffect(()=>{
    const escape=event=>{if(active && event.key==='Escape' && !event.defaultPrevented)player.current.stop();};
    document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
  },[active]);
  async function speak(body) {
    if(preview || !current.current.active || !status?.available)return;
    setError('');
    const withRate=clip=>({...clip,rate});
    try{const started=await player.current.play(Array.isArray(body)?body.map(withRate):withRate(body));if(started && current.current.active)setEnabled(true);}catch(e){if(current.current.active){setEnabled(false);setError(e.message||'Local voice could not play.');}}
  }
  useImperativeHandle(ref,()=>({prepareForReply(){
    if(preview || !active || mode==='off' || status?.available===false)return;
    setError('');
    player.current.unlock().then(()=>{if(current.current.active)setEnabled(true);})
      .catch(e=>{if(current.current.active){setEnabled(false);setError(e.message||'Click Enable voice to allow local audio.');}});
  }}),[preview,active,mode,status]);
  useEffect(()=>{
    if(!reply?.id || reply.id===seen.current)return;
    if(!active || document.hidden || mode==='off'){seen.current=reply.id;return;}
    if(!enabled || !status?.available)return;
    seen.current=reply.id;
    const body=localReplySpeech(mode,reply.text,status?.maxCharacters);
    if(body)speak(body);
  },[reply,active,enabled,mode,status]);
  function choose(id) {
    player.current.stop();setAvatar(id);setError('');
    try{localStorage.setItem('nc-pal-avatar-v1',id);}catch{}
  }
  const label=phase==='speaking'?'Speaking':phase==='preparing'?'Preparing voice':thinking?'Thinking':mode==='off'?'Voice off':enabled?'Voice ready':'Voice off';
  const answer=latestReply || reply?.text || '';
  const clips=replyClips(answer,status?.maxCharacters),canRead=clips.length>0;
  function enableVoice(){
    seen.current=reply?.id;
    speak(answer ? localReplySpeech(mode==='off'?'summary':mode,answer,status?.maxCharacters) : {kind:'notice',notice:`hello-${avatar}`});
  }
  return <section className="local-pal" aria-label="Local NetClaw Pal">
    <div className="local-pal-top"><div><span className="eyebrow">YOUR NETCLAW PAL</span><h2>{PAL_PROFILES[avatar].name}</h2></div><span className={`local-pal-state ${phase}`} role="status"><i/>{label}</span></div>
    {error&&<p className="notice" role="alert">{error}</p>}
    <div className="local-pal-layout"><PalAvatar avatar={avatar} state={thinking?'thinking':phase} replyId={reply?.id} player={player.current} active={active}/>
      <div className="local-pal-options"><span className="eyebrow">CHOOSE YOUR PAL</span>
        <div className="local-pal-choices" role="group" aria-label="Avatar selection">{Object.entries(PAL_PROFILES).map(([id,profile])=><button key={id} aria-pressed={avatar===id} onClick={()=>choose(id)}><img src={`/pal/${id}.png`} alt=""/><span><strong>{profile.name}</strong><small>{profile.subtitle}</small></span><span aria-hidden="true" className="local-pal-check">{avatar===id?'✓':''}</span></button>)}</div>
        <div className="local-pal-voice"><h3>A voice, on your device.</h3><p>{status?.available?'Speech is generated on this Mac. John and Lobster share the system voice for now.':preview?'Local voice is disabled in this preview.':status?.reason||'Checking local voice…'}</p>
          <p className="local-pal-voice-hint">{mode==='off'?'Automatic speech is off. You can still read a reply aloud.':enabled?'Voice is on for new replies in this Avatar view.':'Send a message to activate voice, or click Enable voice to hear it now.'}</p>
          <div className="local-pal-buttons"><button className="primary" disabled={preview||!status?.available||thinking} onClick={enableVoice}>{enabled?'Try voice':'Enable voice'}</button><button disabled={phase==='idle'} onClick={()=>player.current.stop()}>Stop voice</button></div>
          <label htmlFor="local-pal-autospeak">When NetClaw replies</label><select id="local-pal-autospeak" value={mode} onChange={e=>{player.current.stop();seen.current=reply?.id;setPreferences(value=>({...value,mode:e.target.value}));}}><option value="summary">Speak a brief status; keep details in chat</option><option value="full">Read full replies aloud on this device</option><option value="off">Stay quiet until I ask</option></select>
          {mode==='full'&&<p className="local-pal-disclosure">Anyone nearby may hear the answer, including private details. Code and links stay in chat. Replies over {MAX_SPOKEN_REPLY.toLocaleString()} spoken characters get a brief notice.</p>}
          {mode==='summary'&&<p>John or Lobster will say “Your NetClaw reply is ready.” Choose full replies above to hear the answer itself.</p>}
          {answer&&<><button disabled={preview||!status?.available||!canRead||thinking} onClick={()=>{seen.current=reply?.id;speak(clips);}}>Read latest reply</button>{!canRead&&<p>This reply is too long to read aloud. Ask NetClaw for a short summary.</p>}</>}
          {progress.total>1&&<p role="status">Reading part {progress.index} of {progress.total}</p>}
          <details className="local-pal-audio-controls"><summary>Playback settings · {rate.toFixed(2)}× · {Math.round(volume*100)}%</summary><label htmlFor="local-pal-speed">Speech speed <output>{rate.toFixed(2)}×</output></label><input id="local-pal-speed" type="range" min="0.75" max="1.25" step="0.05" value={rate} onChange={e=>{player.current.stop();setPreferences(value=>({...value,rate:Number(e.target.value)}));}} aria-valuetext={`${rate.toFixed(2)} times normal speed`}/>
          <label htmlFor="local-pal-volume">Volume <output>{Math.round(volume*100)}%</output></label><input id="local-pal-volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setPreferences(value=>({...value,volume:Number(e.target.value)}))} aria-valuetext={`${Math.round(volume*100)} percent`}/></details>{volume===0&&<p role="status">Voice is muted. Turn up Volume to hear replies.</p>}
        </div>
        <p className="local-pal-note">Local avatar and voice · no Tavus account needed. Your configured model's usage still applies.</p>
        <details className="local-pal-future"><summary>Your own avatar, next</summary><p>We are proving the shared rig with John and Lobster first. Custom uploads and a Blender conversion script will follow once the format is validated.</p></details>
      </div>
    </div>
    <p className="local-pal-chat-note">Same Chat, same configured model. Voice input can use your operating system's dictation.</p>
  </section>;
});
