from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_registration import native_environment
from setup_state import Conflict

class RegistrationTests(unittest.TestCase):
    def test_native_defaults_and_secret_aliases_stay_in_private_environment(self):
        values={'TOKEN':'private-registration-canary','HOST':'localhost'}
        projected=native_environment('fixture',{'LOCAL_AS':'${LOCAL_AS:-65001}','AUTH':'Bearer ${TOKEN}',
            'URL':'http://${HOST}:${PORT:-8000}','LITERAL':'safe'},values)
        self.assertEqual(projected['LITERAL'],'safe')
        for key,expected in [('LOCAL_AS','65001'),('AUTH','Bearer private-registration-canary'),('URL','http://localhost:8000')]:
            reference=projected[key];self.assertNotIn(':-',reference);self.assertNotIn('canary',reference)
            self.assertEqual(values[reference[2:-1]],expected)
        self.assertEqual(native_environment('fixture',{'LOCAL_AS':'${LOCAL_AS:-65001}'},values)['LOCAL_AS'],projected['LOCAL_AS'])
        other=native_environment('other',{'LOCAL_AS':'${LOCAL_AS:-65002}'},values)
        self.assertNotEqual(other['LOCAL_AS'],projected['LOCAL_AS'])
        self.assertEqual(values[other['LOCAL_AS'][2:-1]],'65002')

    def test_missing_secrets_remain_unresolved_and_conflicting_aliases_refuse(self):
        values={}
        self.assertEqual(native_environment('fixture',{'AUTH':'${TOKEN}'},values),{'AUTH':'${TOKEN}'})
        self.assertEqual(values,{})
        result=native_environment('fixture',{'PORT':'${PORT:-1}'},values)
        values[result['PORT'][2:-1]]='changed'
        with self.assertRaises(Conflict):native_environment('fixture',{'PORT':'${PORT:-1}'},values)
        with self.assertRaises(Conflict):native_environment('fixture',{'PORT':'${not-supported}'},{})

if __name__=='__main__':unittest.main()
