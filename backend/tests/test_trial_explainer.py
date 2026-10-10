import unittest
from types import SimpleNamespace
from app.trial_explainer import simplify_trial, validate_simplifications

class ExplainerTests(unittest.TestCase):
    def setUp(self):
        self.sources=[dict(id='S1',path='protocolSection.descriptionModule.briefSummary',quote='Participants attend 4 visits.')]
        self.record={'protocolSection':{'identificationModule':{'nctId':'NCT00000001'},'descriptionModule':{'briefSummary':'Participants attend 4 visits.'}}}
    def test_rejects_fabricated_counts(self):
        self.assertFalse(validate_simplifications([dict(id='S1',quote=self.sources[0]['quote'],text='There are 8 visits.')],self.sources))
    def test_rejects_uncited_or_changed_quotes(self):
        for source_id,quote in [('S2',self.sources[0]['quote']),('S1','Invented quote')]:
            self.assertFalse(validate_simplifications([dict(id=source_id,quote=quote,text='Four visits.')],self.sources))
    def test_rejects_personal_advice(self):
        self.assertFalse(validate_simplifications([dict(id='S1',quote=self.sources[0]['quote'],text='You should join. It is safe for you.')],self.sources))
    def test_unsupported_question_never_calls_ai(self):
        self.assertEqual(simplify_trial('NCT00000001','compensation',self.sources,client=object())['simplifications'],[])
    def test_source_not_in_official_record_never_calls_ai(self):
        self.assertEqual(simplify_trial('NCT00000001','visits',[dict(self.sources[0],quote='Invented visits')],client=object(),record=self.record)['simplifications'],[])
    def test_valid_generated_explanation_and_failure_fallback(self):
        import json
        class Client:
            def with_options(self,**kw): return self
            @property
            def responses(self): return self
            def create(inner,**kw):
                return SimpleNamespace(output_text=json.dumps({'items':[dict(self.sources[0],text='The study lists 4 visits.')]}))
        result=simplify_trial('NCT00000001','visits',self.sources,client=Client(),record=self.record)
        self.assertEqual(result['simplifications'][0]['text'],'The study lists 4 visits.')
        self.assertEqual(simplify_trial('NCT00000001','visits',self.sources,client=object(),record=self.record)['simplifications'],[])
