import copy
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_advisor import advise
from test_setup_plan import sample_plan

class AdvisorTests(unittest.TestCase):
    def test_five_advisory_answers_change_only_explained_advice(self):
        from setup_schema import Invalid
        plan=sample_plan();before=copy.deepcopy(plan)
        answers={'domains':'several','credentials':'separate','production':'required','cost':'sensitive','growth':'expanding'}
        result=advise(plan,{'memoryBytes':16*1024**3},ROOT,answers)
        self.assertEqual(result['recommendation'],'risk');self.assertEqual(result['answers'],answers)
        self.assertIn('growing-tool-domains',result['reasons']);self.assertGreaterEqual(result['estimatedRequiredClaws'],3)
        self.assertEqual(result['shapeEstimates']['focused']['claws'],1)
        self.assertIsNone(result['shapeEstimates']['risk']['toolContextTokens']);self.assertEqual(plan,before)
        for bad in [{'approved':True},{'production':'approved'},{'cost':'private-free-text'}]:
            with self.assertRaises(Invalid):advise(plan,{},ROOT,bad)

    def test_small_unknown_and_separate_domains_are_advisory_and_never_mutate_plan(self):
        plan=sample_plan();before=copy.deepcopy(plan)
        report=advise(plan,{'memoryBytes':16*1024**3},ROOT)
        self.assertEqual(report['recommendation'],'focused');self.assertEqual(report['feasibility'],'estimated')
        self.assertEqual(plan,before);self.assertFalse(report['automaticChanges'])
        self.assertEqual(advise(plan,{},ROOT)['feasibility'],'unknown')
        second=copy.deepcopy(plan['claws'][0]);second['capabilities']['trustDomain']='separate';plan['claws'].append(second)
        report=advise(plan,{'memoryBytes':4*1024**3},ROOT)
        self.assertEqual(report['recommendation'],'risk');self.assertIn('separate-credential-domains',report['reasons'])
        self.assertEqual(report['feasibility'],'constrained')
        self.assertEqual({p['trustDomain'] for p in report['partitions']},
                         {c['capabilities']['trustDomain'] for c in plan['claws']})
        self.assertGreaterEqual(report['estimatedRequiredClaws'],3)
        second['provider']['kind']='local';self.assertEqual(advise(plan,{'memoryBytes':100*1024**3},ROOT)['feasibility'],'unknown')

if __name__=='__main__':unittest.main()
