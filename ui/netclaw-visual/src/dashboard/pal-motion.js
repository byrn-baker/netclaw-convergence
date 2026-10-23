// Audio envelope uses elapsed time, so speech looks consistent at 30/60/120 Hz.
export function mouthEnvelope(previous,level,seconds){
  const target=Number.isFinite(level)?Math.min(1,Math.max(0,level-.025)):0;
  const dt=Math.min(.1,Math.max(0,Number.isFinite(seconds)?seconds:0));
  const value=previous+(target-previous)*(1-Math.exp(-dt/(target>previous?.035:.085)));
  return value<.001?0:value;
}
export function replyNod(age,reduced=false){
  return !reduced && age>=0 && age<2.4?Math.sin(age*Math.PI*3)*.16*(1-age/2.4):0;
}
export function avatarKeyAction({key,shiftKey=false,altKey=false,metaKey=false,ctrlKey=false}){
  if(altKey||metaKey||ctrlKey)return null;
  const arrow={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[key];
  return arrow?(shiftKey?`pan-${arrow}`:arrow):({'+':'in','=':'in','-':'out',Home:'reset'}[key]||null);
}
