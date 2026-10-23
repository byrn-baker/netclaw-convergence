// Browser-owned playback: audio never leaves the local HUD service.
export class LocalPalAudio {
  constructor({ fetcher = (...args) => fetch(...args), context = () => new (window.AudioContext || window.webkitAudioContext)(), onState = () => {}, onError = () => {}, onProgress = () => {} } = {}) {
    this.fetcher=fetcher;this.createContext=context;this.onState=onState;this.onError=onError;this.onProgress=onProgress;this.sequence=0;this.volume=1;
  }
  clearClip() {
    if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}
    this.analyser?.disconnect();this.analyser=null;this.samples=null;
    this.gain?.disconnect();this.gain=null;
  }
  stop() {
    this.sequence++;
    this.controller?.abort();this.controller=null;
    this.clearClip();this.onProgress({index:0,total:0});this.onState('idle');
  }
  // Called directly from Send/Play so the browser can unlock local audio
  // during the user's gesture, before waiting on the model or speech service.
  async unlock() {
    this.context ||= this.createContext();
    const context=this.context;
    await context.resume();
    if(this.context!==context)throw Error('Local audio was closed. Click Enable voice to resume it.');
    if(context.state && context.state !== 'running') {
      throw Error('Audio is paused by your browser. Click Enable voice to resume it.');
    }
  }
  async play(body) {
    this.stop();const sequence=this.sequence;
    const clips=Array.isArray(body)?body:[body];
    if(!clips.length || clips.length>12)throw Error('This reply is too long for local playback.');
    this.controller=new AbortController();
    const signal=this.controller.signal;
    const startClip=async index=>{
      if(sequence!==this.sequence)return false;
      this.clearClip();this.onState('preparing');this.onProgress({index:index+1,total:clips.length});
      return await this.loadClip(clips[index],{sequence,signal,onEnded:()=>{
        if(sequence!==this.sequence)return;
        if(index+1===clips.length){this.stop();return;}
        startClip(index+1).catch(error=>{if(sequence===this.sequence){this.stop();this.onError(error);}});
      }});
    };
    try {
      await this.unlock();
      if(sequence!==this.sequence)return false;
      return await startClip(0);
    }catch(error){if(sequence===this.sequence){this.stop();throw error;}return false;}
  }
  async loadClip(body,{sequence,signal,onEnded}) {
      const response=await this.fetcher('/api/pal/local/speech',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
      if(!response.ok){const value=await response.json().catch(()=>({}));throw Error(value.error||'Local speech is unavailable.');}
      if(sequence!==this.sequence)return false;
      const bytes=await response.arrayBuffer();
      if(sequence!==this.sequence)return false;
      const buffer=await this.context.decodeAudioData(bytes);
      if(sequence!==this.sequence)return false;
      const source=this.context.createBufferSource(),analyser=this.context.createAnalyser(),gain=this.context.createGain();
      analyser.fftSize=512;source.buffer=buffer;source.connect(analyser);analyser.connect(gain);gain.connect(this.context.destination);
      this.gain=gain;gain.gain.value=this.volume;
      this.source=source;this.analyser=analyser;this.samples=new Float32Array(analyser.fftSize);
      source.onended=onEnded;
      source.start();this.onState('speaking');
      return true;
  }
  level() {
    if(!this.analyser || !this.samples)return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    const energy=this.samples.reduce((sum,value)=>sum+value*value,0)/this.samples.length;
    return Math.min(1,Math.sqrt(energy)*9);
  }
  setVolume(value){this.volume=palPreferences({volume:value}).volume;if(this.gain)this.gain.gain.value=this.volume;}
  dispose(){this.stop();this.context?.close().catch(()=>{});this.context=null;}
}

export const PAL_PROFILES = Object.freeze({
  john:{name:'John',subtitle:'A familiar face',description:'Stylized John · local AI avatar'},
  lobster:{name:'Lobster',subtitle:'A little more shell',description:'NetClaw lobster · local AI avatar'},
});
export function safePalId(value){return Object.hasOwn(PAL_PROFILES,value)?value:'john';}
export const PAL_PREFERENCES_KEY='nc-pal-voice-v1';
export function palPreferences(value={}){
  return {mode:['summary','full','off'].includes(value?.mode)?value.mode:'summary',
    rate:Number.isFinite(value?.rate)?Math.min(1.25,Math.max(.75,value.rate)):1,
    volume:Number.isFinite(value?.volume)?Math.min(1,Math.max(0,value.volume)):1};
}
export function readPalPreferences(storage){try{return palPreferences(JSON.parse(storage.getItem(PAL_PREFERENCES_KEY)));}catch{return palPreferences();}}
export const MAX_SPOKEN_REPLY=8000;
export function spokenReplyText(text){
  if(typeof text!=='string')return '';
  // This is a reading aid, not a model-generated summary. Keep evidence in Chat.
  return text.replace(/```[^\n]*\n[\s\S]*?(?:```|$)/g,' Code is available in chat. ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/https?:\/\/\S+/g,'link in chat')
    .replace(/^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+)/gm,'')
    .replace(/(?:\*\*|__|`)/g,'')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g,' ')
    .replace(/\s+/g,' ').trim();
}
export function replyClips(text,limit=1800){
  let remaining=spokenReplyText(text);
  if(!remaining || remaining.length>MAX_SPOKEN_REPLY)return [];
  const size=Number.isInteger(limit)?Math.min(1800,Math.max(800,limit)):1800,clips=[];
  while(remaining){
    let cut=Math.min(size,remaining.length);
    if(remaining.length>size){
      const prefix=remaining.slice(0,size);
      const sentence=[...prefix.matchAll(/[.!?]\s/g)].at(-1)?.index;
      const boundary=sentence!==undefined && sentence>size/2?sentence+1:prefix.lastIndexOf(' ');
      if(boundary>0)cut=boundary;
      if(/[\uD800-\uDBFF]/.test(remaining[cut-1]))cut--;
    }
    clips.push({kind:'answer',text:remaining.slice(0,cut).trim()});remaining=remaining.slice(cut).trim();
  }
  return clips;
}
export function localReplySpeech(mode,text,limit=1800){
  if(mode==='off')return null;
  if(mode==='full'){
    const clips=replyClips(text,limit);
    if(clips.length)return clips.length===1?clips[0]:clips;
  }
  // Unknown/oversized/private-by-default replies get a fixed public summary.
  return {kind:'notice',notice:'ready'};
}
