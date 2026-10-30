import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export function strictJson(data:Buffer|string,limit=1024*1024):any{
  const text=typeof data==='string'?data:new TextDecoder('utf-8',{fatal:true}).decode(data);
  if(Buffer.byteLength(text)>limit)throw Error('Setup data exceeds its limit.');
  let at=0;
  const fail=():never=>{throw Error('Invalid or ambiguous setup JSON.');};
  const space=()=>{while(/[ \t\r\n]/.test(text[at]||'x'))at++;};
  const string=():string=>{
    const start=at++;let escaped=false;
    while(at<text.length){const c=text[at++];if(c==='"'&&!escaped){
      const value=JSON.parse(text.slice(start,at)) as string;
      if(value.includes('\0')||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value))fail();
      return value;
    } if(c==='\\'&&!escaped)escaped=true;else escaped=false;}
    return fail();
  };
  const value=(depth:number):any=>{
    if(depth>32)fail();space();const c=text[at];
    if(c==='"')return string();
    if(c==='{'){
      at++;space();const object=Object.create(null),seen=new Set<string>();
      if(text[at]==='}'){at++;return object;}
      while(true){space();if(text[at]!=='"')fail();const key=string();
        if(!/^[\x20-\x7e]*$/.test(key)||seen.has(key))fail();seen.add(key);space();if(text[at++]!==':')fail();
        object[key]=value(depth+1);space();const separator=text[at++];if(separator==='}')return object;if(separator!==',')fail();}
    }
    if(c==='['){at++;space();const result:any[]=[];if(text[at]===']'){at++;return result;}
      while(true){result.push(value(depth+1));space();const separator=text[at++];if(separator===']')return result;if(separator!==',')fail();}}
    for(const [literal,result] of [['true',true],['false',false],['null',null]] as const){if(text.startsWith(literal,at)){at+=literal.length;return result;}}
    const number=text.slice(at).match(/^-?(?:0|[1-9]\d*)/);
    if(!number)return fail();at+=number[0].length;const result=Number(number[0]);if(!Number.isSafeInteger(result))fail();return result;
  };
  const result=value(0);space();if(at!==text.length)fail();return result;
}

export function canonical(value:any):string{
  const visit=(v:any,depth=0):string=>{
    if(depth>32)throw Error('Setup data nesting exceeds its limit.');
    if(Array.isArray(v))return '['+v.map(x=>visit(x,depth+1)).join(',')+']';
    if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+visit(v[k],depth+1)).join(',')+'}';
    const result=JSON.stringify(v);if(result===undefined)throw Error('Unsupported setup value.');return result;
  };
  const text=visit(value);strictJson(text);return text;
}
export const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
export function realParents(file:string,sharedRead=false){
  if(!path.isAbsolute(file)||path.normalize(file)!==file)throw Error('Select an absolute normalized path.');
  let current=path.parse(file).root;
  for(const part of file.slice(current.length).split(path.sep)){
    current=path.join(current,part);
    try{const info=fs.lstatSync(current);if(info.isSymbolicLink())throw Error('Setup paths cannot contain symbolic links.');
      if(process.getuid&&info.isDirectory()&&(![0,process.getuid()].includes(info.uid)||(!sharedRead&&(info.mode&0o022)&&!(info.mode&0o1000))))throw Error('Setup parent ownership or permissions are unsafe.');}
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')break;throw error;}
  }
}
export function readData(file:string,limit=1024*1024){
  return strictJson(readBytes(file,limit),limit);
}
export function readBytes(file:string,limit=1024*1024,sharedRead=false){
  realParents(file,sharedRead);const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
  try{const info=fs.fstatSync(fd);if(!info.isFile()||info.size>limit||info.nlink!==1||process.getuid&&info.uid!==process.getuid())throw Error('Setup data file is unavailable.');
    const parts:Buffer[]=[];let total=0;
    while(true){const block=Buffer.alloc(Math.min(65536,limit+1-total)),size=fs.readSync(fd,block);if(!size)break;
      total+=size;if(total>limit)throw Error('Setup data exceeds its limit.');parts.push(block.subarray(0,size));}
    const after=fs.fstatSync(fd);if(info.size!==after.size||info.mtimeMs!==after.mtimeMs)throw Error('Setup data changed during observation.');return Buffer.concat(parts);}
  finally{fs.closeSync(fd);}
}
