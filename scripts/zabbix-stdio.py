#!/usr/bin/env python3
"""Contain blank/unresolved TLS flags before launching unmodified Zabbix MCP."""
import os
import runpy


def main():
    value = os.environ.get('VERIFY_SSL', '').strip().lower()
    os.environ['VERIFY_SSL'] = 'false' if value in ('false', '0', 'no') else 'true'
    runpy.run_module('zabbix_mcp_server.server', run_name='__main__')


if __name__ == '__main__':
    main()
