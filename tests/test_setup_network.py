import asyncio
import importlib.util
from pathlib import Path
import types
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('setup_network',ROOT/'scripts/setup-network-check.py')
network=importlib.util.module_from_spec(spec);spec.loader.exec_module(network)

class NetworkTests(unittest.TestCase):
    def test_only_exact_selected_inventory_device_receives_one_read_only_command(self):
        class Session:
            def __init__(self):self.calls=[];self.device='fixture-router'
            async def call_tool(self,name,args):
                self.calls.append((name,args))
                value={'status':'completed','devices':{'fixture-router':{'private':'never-exported'}}} if name=='pyats_list_devices' else {'status':'completed','device':self.device,'command':'show version','output':'private fixture output'}
                return types.SimpleNamespace(is_error=False,structured_content=value,content=[])
        s=Session();self.assertEqual(asyncio.run(network.observe_session(s)),{'devices':['fixture-router']});self.assertEqual(len(s.calls),1)
        s=Session();self.assertEqual(asyncio.run(network.observe_session(s,'foreign-router')),{'verified':False});self.assertEqual(len(s.calls),1)
        s=Session();self.assertEqual(asyncio.run(network.observe_session(s,'fixture-router')),{'verified':True})
        self.assertEqual(s.calls[-1],('pyats_run_show_command',{'device_name':'fixture-router','command':'show version','timeout':30,'retries':1}))
        s=Session();s.device='foreign-router';self.assertEqual(asyncio.run(network.observe_session(s,'fixture-router')),{'verified':False})

if __name__=='__main__':unittest.main()
