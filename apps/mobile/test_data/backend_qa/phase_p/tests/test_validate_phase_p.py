from __future__ import annotations
import importlib.util, json, unittest
from pathlib import Path

HERE=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('phase_p_validator', HERE/'validate_phase_p.py')
mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

class PhasePValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.collection=json.loads((HERE/'TOEIC_Phase_P_Backend_QA.postman_collection.json').read_text(encoding='utf-8'))
        cls.env=json.loads((HERE/'TOEIC_Phase_P_QA.postman_environment.template.json').read_text(encoding='utf-8'))
    def test_collection_and_environment_are_valid(self):
        errors,count=mod.validate(self.collection,self.env)
        self.assertEqual([],errors)
        self.assertGreaterEqual(count,25)
        self.assertTrue(all('auth' in x['request'] for x in mod.iter_items(self.collection['item'])))
    def test_unapproved_route_is_rejected(self):
        bad=json.loads(json.dumps(self.collection))
        first=next(mod.iter_items(bad['item']))
        first['request']['url']='{{baseUrl}}/api/v1/admin/users'
        errors,_=mod.validate(bad,self.env)
        self.assertTrue(any('Unapproved route/method' in x for x in errors))
    def test_nonempty_password_in_template_is_rejected(self):
        bad=json.loads(json.dumps(self.env))
        next(x for x in bad['values'] if x['key']=='qaUserAPassword')['value']='do-not-store'
        errors,_=mod.validate(self.collection,bad)
        self.assertTrue(any('qaUserAPassword' in x for x in errors))
    def test_seed_id_must_not_be_baked_into_template(self):
        bad=json.loads(json.dumps(self.env))
        next(x for x in bad['values'] if x['key']=='seedTestId')['value']='12345678-1234-4234-8234-123456789abc'
        errors,_=mod.validate(self.collection,bad)
        self.assertTrue(any('seedTestId' in x for x in errors))

    def test_preflight_stops_non_qa_and_gates_later_folders(self):
        errors,_=mod.validate(self.collection,self.env)
        self.assertFalse(errors, errors)
        first=self.collection['item'][0]['item'][0]
        first_scripts='\n'.join(line for ev in first.get('event',[]) for line in ev.get('script',{}).get('exec',[]))
        self.assertIn('qaReadyConfirmed',first_scripts)
        self.assertIn('pm.execution.setNextRequest(null)',first_scripts)
        self.assertIn('d.checks && typeof d.checks === \"object\"',first_scripts)
        for folder in self.collection['item'][1:]:
            guard='\n'.join(line for ev in folder.get('event',[]) for line in ev.get('script',{}).get('exec',[]))
            self.assertIn('pm.execution.skipRequest()',guard)

    def test_attempt_start_and_submit_assert_created_status(self):
        errors,_=mod.validate(self.collection,self.env)
        self.assertFalse(any('HTTP 201' in x for x in errors), errors)
        for name in ('Start FULL attempt','Submit FULL attempt'):
            item=next(x for x in mod.iter_items(self.collection['item']) if x['name']==name)
            script='\n'.join(line for ev in item.get('event',[]) if ev.get('listen')=='test' for line in ev.get('script',{}).get('exec',[]))
            self.assertIn('pm.response.to.have.status(201)',script)

if __name__=='__main__': unittest.main()
