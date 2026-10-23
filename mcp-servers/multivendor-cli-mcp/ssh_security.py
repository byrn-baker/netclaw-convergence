"""Explicit device identity verification for multivendor SSH transports."""
import os
from pathlib import Path


def strict():
    return os.environ.get('MULTIVENDOR_SSH_STRICT', 'true').lower() not in ('false', '0', 'no')


def options(device=None, credential=None):
    result = {'ssh_strict': strict(), 'system_host_keys': True}
    known_hosts = os.environ.get('MULTIVENDOR_KNOWN_HOSTS')
    if known_hosts:
        path = Path(known_hosts).expanduser()
        if not path.is_file():
            raise ValueError('MULTIVENDOR_KNOWN_HOSTS must name a trusted host-key file')
        result.update(alt_host_keys=True, alt_key_file=str(path))
    if credential and credential.key_file:
        result.update(use_keys=True, key_file=credential.key_file)
    if device:
        port = os.environ.get('MULTIVENDOR_' + device.replace('-', '_').upper() + '_PORT')
        if port:
            port = int(port)
            if not 1 <= port <= 65535:
                raise ValueError('Invalid SSH port')
            result['port'] = port
    return result


def secure_napalm_connection(connection, driver):
    if driver == 'junos':
        # NAPALM does not forward hostkey_verify to PyEZ. Guard this narrow SDK
        # adapter: if its verified field changes, fail before opening a socket.
        device = getattr(connection, 'device', None)
        if not hasattr(device, '_hostkey_verify'):
            raise ValueError('Installed Junos adapter cannot enforce SSH host-key verification')
        device._hostkey_verify = strict()
