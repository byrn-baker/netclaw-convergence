import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cookieFrom } from './bindings.js';

const execute = promisify(execFile);
export const MAX_SPEECH_CHARS = 1800;
export const PAL_NOTICES = Object.freeze({
  ready: 'Your NetClaw reply is ready. The details are in your chat.',
  'hello-john': 'Hi, I am John, your NetClaw Pal. Choose a question below and let us work through it together.',
  'hello-lobster': 'Hello! I am your NetClaw lobster. Same Claw, a little more shell. What shall we investigate?',
});
const fail = (status, message) => Object.assign(new Error(message), { status });
export function speechRate(value=1){
  if(typeof value!=='number' || !Number.isFinite(value) || value<.75 || value>1.25)throw fail(400,'Speech speed must be between 0.75 and 1.25.');
  return value;
}
export function speechText(body) {
  if (body?.kind === 'notice' && Object.hasOwn(PAL_NOTICES, body.notice)) return PAL_NOTICES[body.notice];
  if (body?.kind !== 'answer' || typeof body.text !== 'string' || !body.text.trim() ||
      body.text.length > MAX_SPEECH_CHARS || /[\x00-\x08\x0b-\x1f\x7f]/.test(body.text)) {
    throw fail(400, `Choose a notice or between 1 and ${MAX_SPEECH_CHARS} characters for local playback.`);
  }
  return body.text.trim();
}

// Presentation adapter only: no model, device tools, shell or hosted TTS.
export function localSpeech({ platform = process.platform, run = execute, available } = {}) {
  const supported = available ?? (platform === 'darwin' && existsSync('/usr/bin/say') && existsSync('/usr/bin/afconvert'));
  let busy = false;
  return {
    status: () => ({ available: supported, engine: supported ? 'macOS system voice' : null,
      maxCharacters: MAX_SPEECH_CHARS, reason: supported ? null : 'Local speech currently requires the macOS system voice. Text chat and avatars still work.' }),
    async synthesize(text, signal, rate=1) {
      speechRate(rate);
      if (!supported) throw fail(503, 'The local speech engine is unavailable on this host.');
      if (busy) throw fail(409, 'Local speech is busy. Stop playback and try again.');
      busy = true;
      let directory;
      try {
        signal?.throwIfAborted();
        directory = await fs.mkdtemp(path.join(os.tmpdir(), 'netclaw-pal-speech-'));
        await fs.chmod(directory, 0o700);
        const input = path.join(directory, 'input.txt'), aiff = path.join(directory, 'speech.aiff'), wav = path.join(directory, 'speech.wav');
        await fs.writeFile(input, text, { mode: 0o600 });
        const options = { timeout: 30000, maxBuffer: 65536, signal, windowsHide: true };
        await run('/usr/bin/say', ['-f', input, '-o', aiff, '-r', String(Math.round(175*rate))], options);
        await run('/usr/bin/afconvert', ['-f', 'WAVE', '-d', 'LEI16', aiff, wav], options);
        const stat = await fs.stat(wav);
        if (stat.size > 12 * 1024 * 1024 || stat.size < 44) throw Error('invalid-audio-size');
        signal?.throwIfAborted();
        return await fs.readFile(wav);
      } finally {
        try { if (directory) await fs.rm(directory, { recursive: true, force: true }); }
        finally { busy = false; }
      }
    },
  };
}

export function mountLocalPal(app, { bindings, speech = localSpeech() }) {
  const authorize = (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try { bindings.read(cookieFrom(req)); next(); }
    catch { res.status(401).json({ error: 'Authentication required.' }); }
  };
  app.get('/api/pal/local/status', authorize, (_req, res) => res.json(speech.status()));
  app.post('/api/pal/local/speech', authorize, async (req, res) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.once('aborted', abort);
    res.once('close', abort);
    try {
      const text = speechText(req.body);
      const audio = await speech.synthesize(text, controller.signal, speechRate(req.body.rate));
      // Re-check revocation after work; never return another owner's speech.
      bindings.read(cookieFrom(req));
      if (!controller.signal.aborted) res.type('audio/wav').send(audio);
    } catch (error) {
      if (!controller.signal.aborted && !res.headersSent) res.status(error.status || 503).json({
        error: error.status ? error.message : 'Local speech could not finish. Text chat remains available.',
      });
    } finally { req.off('aborted', abort); res.off('close', abort); }
  });
}
