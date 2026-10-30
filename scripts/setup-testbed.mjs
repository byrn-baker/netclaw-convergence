#!/usr/bin/env node
import fs from 'node:fs';
import {normalizeSetupTestbed} from '../ui/netclaw-visual/testbed-document.js';
// Private input filename only. Never echo parser errors or source contents.
try {
  const [file,format]=process.argv.slice(2);
  if(!file||!['yaml','json','csv'].includes(format))throw Error();
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
  let data;
  try {
    const s=fs.fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.uid!==process.getuid()||s.size>256*1024||(s.mode&0o077))throw Error();
    data=fs.readFileSync(fd,'utf8');
  } finally {fs.closeSync(fd);}
  process.stdout.write(normalizeSetupTestbed(data,format));
} catch {process.exitCode=2;}
