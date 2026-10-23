// Terminal inventory and credential resolution. No HTTP or SSH side effects on import.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import yaml from 'js-yaml';
import { testbedRevision } from './testbed-editor.js';

function cleanConfiguredValue(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (
    text.length >= 2
    && ((text.startsWith('"') && text.endsWith('"'))
      || (text.startsWith("'") && text.endsWith("'")))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

function resolveConfiguredValue(value, envVars) {
  const text = cleanConfiguredValue(value);
  const envRef = text.match(/^%ENV\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  return envRef ? cleanConfiguredValue(envVars[envRef[1]]) : text;
}

function expandLocalPath(filePath) {
  if (!filePath) return '';
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return path.resolve(filePath);
}

function validateTerminalProfileInput(value) {
  const input = value && typeof value === 'object' ? value : {};
  const id = String(input.id || '').trim();
  const host = String(input.host || '').trim();
  const portText = input.port == null ? '' : String(input.port).trim();
  const port = portText ? Number(portText) : 22;
  const cleanOptional = (field, fallback, limit = 80) => {
    const text = String(input[field] || '').trim();
    if (!text) return fallback;
    if (text.length > limit || /[\r\n\0]/.test(text)) {
      throw new Error(`${field} contains unsupported characters or is too long.`);
    }
    return text;
  };

  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(id)) {
    throw new Error('Device ID must be 1-64 letters, numbers, dots, underscores, or hyphens.');
  }
  if (
    !host
    || host.length > 253
    || /[\s\r\n\0/@]/.test(host)
    || (
      net.isIP(host) === 0
      && !/^(?:[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?\.)*[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/.test(host)
    )
  ) {
    throw new Error('Host must be a hostname or IP address, without a URL scheme or path.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SSH port must be an integer from 1 through 65535.');
  }

  return {
    id,
    device: {
      alias: cleanOptional('alias', id),
      type: cleanOptional('type', 'device', 40),
      os: cleanOptional('os', 'unknown', 40),
      platform: cleanOptional('platform', 'unknown', 60),
      connections: {
        defaults: {
          class: 'unicon.Unicon',
        },
        ssh: {
          protocol: 'ssh',
          ip: host,
          port,
        },
      },
    },
  };
}


// Inject the existing readers so environment and inventory edits remain live;
// never snapshot credentials or the testbed at server startup.
export function createTerminalProfiles({ parseTestbed, parseEnvFile, readText, getTestbedFile, pickDeviceConnection }) {
  function listTerminalProfiles() {
    const testbed = parseTestbed();
    const revision = testbedRevision(readText(getTestbedFile()) || '');
    return Object.entries(testbed?.devices || {}).flatMap(([name, device]) => {
      const picked = pickDeviceConnection(device);
      if (!picked) return [{ id: name, name, alias: device.alias || name, type: device.type || 'device',
        os: device.os || 'unknown', platform: device.platform || 'unknown', connection: '', protocol: 'none',
        host: '', port: null, supported: false, revision }];
      const protocol = String(picked.connection.protocol || picked.name || 'ssh').toLowerCase();
      const host = cleanConfiguredValue(picked.connection.ip || picked.connection.host);
      const port = Number.parseInt(picked.connection.port, 10) || (protocol === 'ssh' ? 22 : 23);
      return [{
        id: name,
        name,
        alias: device.alias || name,
        type: device.type || 'device',
        revision,
        os: device.os || 'unknown',
        platform: device.platform || 'unknown',
        connection: picked.name,
        protocol,
        host,
        port,
        supported: protocol === 'ssh' && Boolean(host),
      }];
    });
  }

  // Append one structured device entry without serializing the existing testbed.
  // This keeps comments, ordering, credentials, and unrelated custom fields intact.
  function appendTerminalProfile(value) {
    const { id, device } = validateTerminalProfileInput(value);
    const source = readText(getTestbedFile()) || '';
    const testbed = source ? (yaml.load(source) || {}) : {};
    if (testbed.devices != null && (
      typeof testbed.devices !== 'object'
      || Array.isArray(testbed.devices)
    )) {
      throw new Error('The existing devices section is not a YAML mapping.');
    }
    if (Object.prototype.hasOwnProperty.call(testbed.devices || {}, id)) {
      const error = new Error(`Device "${id}" already exists; existing entries are never overwritten.`);
      error.code = 'DEVICE_EXISTS';
      throw error;
    }

    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const snippet = yaml.dump(
      { [id]: device },
      { noRefs: true, noCompatMode: true, lineWidth: -1 },
    ).trimEnd().split('\n').map((line) => `  ${line}`);
    const lines = source ? source.split(/\r?\n/) : [];
    const devicesIndex = lines.findIndex((line) => /^\uFEFF?devices\s*:/.test(line));

    if (devicesIndex < 0) {
      while (lines.length && lines.at(-1) === '') lines.pop();
      if (lines.length) lines.push('');
      lines.push('devices:', ...snippet, '');
    } else {
      const devicesLine = lines[devicesIndex];
      const inlineValue = devicesLine.replace(/^\uFEFF?devices\s*:\s*/, '');
      const commentIndex = inlineValue.indexOf('#');
      const valueWithoutComment = (commentIndex >= 0
        ? inlineValue.slice(0, commentIndex)
        : inlineValue).trim();
      if (valueWithoutComment === '{}') {
        const comment = commentIndex >= 0 ? ` ${inlineValue.slice(commentIndex).trim()}` : '';
        lines.splice(devicesIndex, 1, `devices:${comment}`, ...snippet);
      } else if (valueWithoutComment) {
        throw new Error('The existing devices section must use an indented YAML mapping.');
      } else {
        let sectionEnd = lines.length;
        for (let index = devicesIndex + 1; index < lines.length; index += 1) {
          if (/^[^\s#][^:]*\s*:/.test(lines[index])) {
            sectionEnd = index;
            break;
          }
        }
        let insertionIndex = sectionEnd;
        while (
          insertionIndex > devicesIndex + 1
          && /^\s*(?:#.*)?$/.test(lines[insertionIndex - 1])
        ) {
          insertionIndex -= 1;
        }
        if (insertionIndex > devicesIndex + 1) lines.splice(insertionIndex, 0, '');
        insertionIndex += insertionIndex > devicesIndex + 1 ? 1 : 0;
        lines.splice(insertionIndex, 0, ...snippet);
        if (sectionEnd < lines.length && lines[insertionIndex + snippet.length] !== '') {
          lines.splice(insertionIndex + snippet.length, 0, '');
        }
      }
    }

    const nextSource = lines.join(newline);
    yaml.load(nextSource);
    fs.mkdirSync(path.dirname(getTestbedFile()), { recursive: true });
    const tempFile = `${getTestbedFile()}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(tempFile, nextSource, 'utf8');
      fs.renameSync(tempFile, getTestbedFile());
    } catch (error) {
      try { fs.unlinkSync(tempFile); } catch {}
      throw error;
    }
    return id;
  }

  function getTerminalProfile(deviceId, { credentialOverride = null } = {}) {
    const testbed = parseTestbed();
    const found = Object.entries(testbed?.devices || {})
      .find(([name]) => name === deviceId);
    if (!found) throw new Error('That device is not present in testbed.yaml.');

    const [name, device] = found;
    const picked = pickDeviceConnection(device);
    if (!picked) throw new Error('The selected device has no terminal connection profile.');

    const protocol = String(picked.connection.protocol || picked.name || 'ssh').toLowerCase();
    if (protocol !== 'ssh') {
      throw new Error('Only SSH VTY and SSH console-server profiles are supported.');
    }

    const envVars = { ...parseEnvFile(), ...process.env };
    const globalCredentials = testbed?.testbed?.credentials?.default || {};
    const deviceCredentials = device?.credentials?.default || {};
    const connectionCredentials = picked.connection?.credentials?.default
      || picked.connection?.credentials
      || {};
    const credentials = {
      ...globalCredentials,
      ...deviceCredentials,
      ...connectionCredentials,
    };

    const host = resolveConfiguredValue(
      picked.connection.ip || picked.connection.host,
      envVars,
    );
    const port = Number.parseInt(picked.connection.port, 10) || 22;
    const username = credentialOverride?.username || resolveConfiguredValue(
      credentials.username || envVars.NETCLAW_USERNAME,
      envVars,
    );
    const password = credentialOverride?.password ?? resolveConfiguredValue(
      credentials.password || envVars.NETCLAW_PASSWORD,
      envVars,
    );
    const passphrase = credentialOverride ? '' : resolveConfiguredValue(
      credentials.passphrase || envVars.NETCLAW_SSH_KEY_PASSPHRASE,
      envVars,
    );
    const privateKeyValue = credentialOverride ? '' : resolveConfiguredValue(
      credentials.privateKey
        || credentials.private_key
        || picked.connection?.ssh_options?.private_key
        || envVars.NETCLAW_SSH_PRIVATE_KEY,
      envVars,
    );

    if (!host) throw new Error('The selected connection has no host or IP address.');
    if (!username) throw new Error('No SSH username is configured for this device.');

    let privateKey = '';
    if (privateKeyValue.startsWith('-----BEGIN ')) {
      privateKey = privateKeyValue;
    } else if (privateKeyValue) {
      const keyPath = expandLocalPath(privateKeyValue);
      if (!fs.existsSync(keyPath)) throw new Error('The configured SSH private key was not found.');
      privateKey = fs.readFileSync(keyPath);
    }

    if (!password && !privateKey && !process.env.SSH_AUTH_SOCK) {
      throw new Error('No SSH password, private key, or SSH agent is configured.');
    }

    return {
      id: name,
      name,
      alias: device.alias || name,
      os: device.os || 'unknown',
      platform: device.platform || 'unknown',
      connection: picked.name,
      protocol,
      host,
      port,
      username,
      password,
      privateKey,
      passphrase,
      agent: credentialOverride ? '' : (process.env.SSH_AUTH_SOCK || ''),
    };
  }

  return { listTerminalProfiles, appendTerminalProfile, getTerminalProfile };
}
export { cleanConfiguredValue, validateTerminalProfileInput };
