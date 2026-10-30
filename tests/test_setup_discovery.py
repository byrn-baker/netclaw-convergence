import json
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))


class DiscoveryTests(unittest.TestCase):
    def test_only_explicit_loopback_read_routes_and_bounded_projection(self):
        from setup_discovery import discover
        calls=[]
        def get(url):
            calls.append(url)
            return {'models':[{'name':'fixture:7b','size':1234,'details':{'parameter_size':'7B','quantization_level':'Q4_K_M'},'secret':'never'}]}
        report=discover('ollama','http://localhost:11434/v1',get=get)
        self.assertEqual(calls,['http://127.0.0.1:11434/api/tags'])
        self.assertEqual(report['models'][0]['installedBytes'],1234)
        self.assertNotIn('secret',json.dumps(report))
        self.assertIsNone(report['models'][0]['downloadBytes'])
        for url in ('http://192.0.2.1:1234','http://user:pass@127.0.0.1','http://127.0.0.1/?key=secret','http://localhost.evil.test','http://localhost/api/pull'):
            with self.assertRaises(ValueError):discover('ollama',url,get=get)
        self.assertEqual(len(calls),1)

    def test_lmstudio_loaded_instances_embedding_and_unknown_metadata(self):
        from setup_discovery import discover
        report=discover('lm-studio','http://127.0.0.1:1234/v1',get=lambda url:{'models':[
            {'type':'llm','key':'fixture','size_bytes':123,'max_context_length':8192,'loaded_instances':[{'id':'loaded'}],'capabilities':{'trained_for_tool_use':True}},
            {'type':'embedding','key':'embedding'}, {'type':'llm','key':'unknown'}]})
        self.assertEqual(len(report['models']),2)
        self.assertEqual(report['models'][0]['loaded'],True)
        self.assertIsNone(report['models'][1]['installedBytes'])
        self.assertEqual(report['inference'],'unverified')

    def test_auth_unavailable_and_missing_sizes_never_download(self):
        from setup_discovery import discover,download_advice
        from urllib.error import HTTPError
        def get(url):raise HTTPError(url,401,'private error',{},None)
        self.assertEqual(discover('lm-studio','http://127.0.0.1:1234/v1',get=get)['state'],'authentication_required')
        result=download_advice({'id':'missing','installedBytes':None,'downloadBytes':None},{'memoryBytes':None,'diskFreeBytes':None})
        self.assertEqual(result['state'],'deferred')
        self.assertFalse(result['automaticDownload'])
        self.assertNotIn('private error',json.dumps(result))

    def test_response_limits_and_malformed_metadata_fail_closed(self):
        from setup_discovery import discover
        self.assertEqual(discover('ollama','http://127.0.0.1:11434',get=lambda url:{'models':[{}]*513})['state'],'unverified')
        report=discover('ollama','http://127.0.0.1:11434',get=lambda url:{'models':[{'name':'x','size':-1},{'name':'bad\nname','size':1}]})
        self.assertEqual(len(report['models']),1);self.assertIsNone(report['models'][0]['installedBytes'])


if __name__=='__main__':unittest.main()
