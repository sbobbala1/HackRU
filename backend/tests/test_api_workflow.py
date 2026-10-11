import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app


class APIWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_complete_cached_trial_fhir_match_explainer_workflow(self):
        with patch('app.trial_explainer.fetch_record', side_effect=AssertionError('No external trial API in demo')), patch('app.trial_explainer._client', side_effect=AssertionError('No LLM in demo')):
            response = self.client.get('/demo/studies/NCT05564039/evaluate')
            self.assertEqual(response.status_code,200)
            data=response.json()
            self.assertTrue(data['cached'])
            self.assertEqual(len(data['profiles']),3)
            self.assertTrue(all(p['synthetic'] for p in data['profiles']))
            self.assertTrue(data['parsed']['source_hash'])
            self.assertEqual(data['parsed']['parser'],'deterministic')
            for match in data['matches']:
                self.assertEqual(sum(match['counts'].values()), len(match['criteria']))
            explanation=self.client.post('/trials/explain',json={'nct_id':'NCT05564039','question':'What is this study trying to find out?','demo':True})
            self.assertEqual(explanation.status_code,200)
            self.assertEqual(explanation.json()['status'],'supported')
            self.assertTrue(explanation.json()['citations'])

    def test_default_parse_and_rank_never_call_llm(self):
        with patch('app.main._attach_llm_suggestions',side_effect=AssertionError('Unexpected LLM')), patch('app.main.summarize_match',side_effect=AssertionError('Unexpected LLM')):
            parsed=self.client.post('/eligibility/parse',json={'study_id':'QA','original_eligibility_text':'Age 18 to 75 years.'})
            self.assertEqual(parsed.status_code,200)
            ranked=self.client.post('/eligibility/rank',json={'study_nct_id':'QA','eligibility_text':'Age 18 to 75 years.','profiles':[{'profile_id':'SYN-1','age':40},{'profile_id':'SYN-2'}]})
            self.assertEqual(ranked.status_code,200)
            self.assertEqual(ranked.json()[1]['counts']['UNKNOWN'],1)

    def test_invalid_input_and_unknown_snapshot_are_rejected(self):
        self.assertEqual(self.client.get('/demo/studies/NCT99999999/evaluate').status_code,404)
        self.assertEqual(self.client.post('/trials/explain',json={'nct_id':'wrong','question':'Hi'}).status_code,422)
        self.assertEqual(self.client.post('/synthetic/patients/import',json={'bundle':{},'synthetic_attested':False}).status_code,422)
        self.assertEqual(self.client.post('/eligibility/parse',json={'study_id':'QA','original_eligibility_text':''}).status_code,422)

    def test_privileged_backend_actions_still_require_auth(self):
        self.assertIn(self.client.get('/trials/anything/matches').status_code,(401,403))

    def test_malformed_llm_hints_do_not_break_deterministic_parser(self):
        with patch('app.main._attach_llm_suggestions',side_effect=ValueError('Malformed provider JSON')):
            response=self.client.post('/eligibility/parse',json={'study_id':'QA','original_eligibility_text':'Age 18 to 75 years.','use_ai':True})
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['parser'],'deterministic')
