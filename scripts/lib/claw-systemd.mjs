// Typed, read-only systemd observation shared by setup-owned editor controls.
const bus=['--user','--json=short','--no-pager','--timeout=10'],dest='org.freedesktop.systemd1';

export function systemdUnitPath(unit){
  if(typeof unit!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.service$/.test(unit))throw Error('Setup unit is invalid.');
  return '/org/freedesktop/systemd1/unit/'+[...unit].map(c=>/^[A-Za-z0-9]$/.test(c)?c:'_'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('');
}

export async function observeSystemdArgv(run,item){
  const unit=item.file.split('/').at(-1),object=systemdUnitPath(unit),expected=item.arguments,flags=item.execFlags===undefined?[]:item.execFlags;
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  if((!equal(flags,[])&&!equal(flags,['no-env-expand']))||!Array.isArray(expected)||!expected.length||expected.some(a=>typeof a!=='string'||!a||a.includes('\0'))||(!flags.length&&expected.some(a=>a.includes('$'))))throw Error('Setup argv cannot be verified.');
  const read=async args=>{
    const raw=await run('/usr/bin/busctl',[...bus,...args]);
    if(typeof raw!=='string'||Buffer.byteLength(raw)>65536)throw Error('Setup bus output is invalid.');
    const value=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value)||!equal(Object.keys(value).sort(),['data','type']))throw Error('Setup bus output is invalid.');
    return value;
  };
  const selected=await read(['call',dest,'/org/freedesktop/systemd1',dest+'.Manager','GetUnit','s',unit]);
  if(selected.type!=='o'||!equal(selected.data,[object]))throw Error('Loaded setup unit changed.');
  const value=await read(['get-property',dest,object,dest+'.Service','ExecStartEx']),rows=value.data;
  if(value.type!=='a(sasasttttuii)'||!Array.isArray(rows)||rows.length!==1)throw Error('Loaded setup argv is unverified.');
  const row=rows[0];
  if(!Array.isArray(row)||row.length!==10||!equal(row.slice(0,3),[expected[0],expected,flags])||row.slice(3,8).some(n=>!Number.isSafeInteger(n)||n<0)||row[7]>4294967295||row.slice(8).some(n=>!Number.isInteger(n)||n< -2147483648||n>2147483647))throw Error('Loaded setup argv differs from the owned definition.');
  return true;
}
