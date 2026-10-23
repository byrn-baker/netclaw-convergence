"""Offline acceptance using the installed ANTA SSLParameters API."""
import asyncio
from pathlib import Path
import ssl
import sys
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'mcp-servers/anta-mcp'))
import server
import anta.device

async def main():
    for verify in (True,False):
        seen={}
        class Device:
            established=False
            def __init__(self,**kwargs):seen.update(kwargs)
            async def refresh(self):pass
            async def disconnect(self):seen['closed']=True
        with patch.object(anta.device,'AsyncEOSDevice',Device):
            result=await server._run('fixture.example',[],{},'fixture','fixture','',verify,443)
        context=seen['ssl_params'].create_ssl_context(trust_env=False)
        assert context.verify_mode==(ssl.CERT_REQUIRED if verify else ssl.CERT_NONE)
        assert context.check_hostname is verify
        assert seen['insecure'] is False and seen['closed']
        assert result['tls_verified'] is verify
    print('PASS: ANTA certificate and hostname enforcement, explicit override, device cleanup')

asyncio.run(main())
