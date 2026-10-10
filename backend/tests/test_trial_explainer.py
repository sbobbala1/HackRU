import unittest
from types import SimpleNamespace
from app.trial_explainer import simplify_trial, validate_simplifications, answer_trial_question, source_fields

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

class QuestionTests(unittest.TestCase):
    def setUp(self):
        self.record={'protocolSection':{'identificationModule':{'nctId':'NCT00000001'},'descriptionModule':{'briefSummary':'Participants attend 4 visits.'},'armsInterventionsModule':{'interventions':[{'description':'A questionnaire is completed.'}]}}}
        self.source={'path':'protocolSection.descriptionModule.briefSummary','quote':'Participants attend 4 visits.'}
    def client(self,data):
        import json
        outer=self
        class Client:
            def with_options(self,**kw): return self
            @property
            def responses(self): return self
            def create(self,**kw):
                outer.request=kw
                return SimpleNamespace(output_text=json.dumps(data))
        return Client()
    def test_arbitrary_question_reaches_ai_with_full_record(self):
        client=self.client({'status':'supported','message':'ignored','claims':[{'text':'The study lists 4 visits.','sources':[self.source]}]})
        result=answer_trial_question('NCT00000001','Tell me about the appointments please',client=client,record=self.record)
        self.assertIn('Tell me about the appointments please',self.request['input'][1]['content'])
        self.assertIn('A questionnaire is completed.',self.request['input'][1]['content'])
        self.assertEqual(result['claims'][0]['source_ids'],['S1'])
    def test_fabricated_citation_or_quantity_rejected(self):
        for source,text in [(dict(self.source,quote='Invented'), '4 visits'),(self.source,'8 visits')]:
            with self.assertRaises(ValueError):
                answer_trial_question('NCT00000001','How many visits?',client=self.client({'status':'supported','message':'','claims':[{'text':text,'sources':[source]}]}),record=self.record)
    def test_missing_and_advice_do_not_display_model_facts(self):
        for state in ('missing','advice'):
            result=answer_trial_question('NCT00000001','Will I get paid?',client=self.client({'status':state,'message':'You get $1000 and should join','claims':[]}),record=self.record)
            self.assertEqual(result['citations'],[])
            self.assertNotIn('$1000',result['answer'])
    def test_all_nested_protocol_fields_indexed(self):
        self.assertEqual(source_fields(self.record)['protocolSection.armsInterventionsModule.interventions[0].description'],'A questionnaire is completed.')
    def test_unsupported_language(self):
        result=answer_trial_question('NCT00000001','Question','es',client=object(),record=self.record)
        self.assertIn('English',result['answer'])
