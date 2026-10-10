import copy
import json
import unittest
from datetime import date
from pathlib import Path
from app.synthetic_patients import import_bundle, normalize_quantity, match_normalized
from app.eligibility_parser import parse_deterministic

class SyntheticTests(unittest.TestCase):
    def setUp(self):
        self.bundle = json.loads((Path(__file__).parents[1]/'app/data/synthetic_demo.json').read_text())[0]
        self.today = date(2026,10,10)
    def profile(self, bundle=None):
        return import_bundle(bundle or self.bundle, True, self.today)
    def test_attestation_and_shape(self):
        with self.assertRaises(ValueError): import_bundle(self.bundle)
        with self.assertRaises(ValueError): import_bundle({}, True)
    def test_identity_and_provenance(self):
        self.bundle['entry'][0]['resource']['name']=[{'family':'NEVER RETURN THIS'}]
        p=self.profile()
        self.assertNotIn('NEVER RETURN THIS', json.dumps(p))
        self.assertEqual(p['age'],52)
        self.assertIn('entry[0]',p['age_source']['path'])
        self.assertTrue(p['observations'][0]['usable'])
    def test_conversion(self):
        value,unit,reason=normalize_quantity('2345-7',5,'mmol/L')
        self.assertAlmostEqual(value,90.091)
        self.assertEqual(unit,'mg/dl')
        self.assertEqual(normalize_quantity('4548-4',5,'mmol/L')[0],5)
        with self.assertRaises(ValueError): normalize_quantity('2345-7',float('nan'),'mg/dL')
    def test_missing_stale_future_and_malformed(self):
        for value,stamp in [(None,'2026-10-01'),(8,'2020-01-01'),(8,'2027-01-01'),('bad','2026-10-01')]:
            b=copy.deepcopy(self.bundle); r=b['entry'][-1]['resource'];r['valueQuantity']['value']=value;r['effectiveDateTime']=stamp
            self.assertFalse(self.profile(b)['observations'][0]['usable'])
    def test_contradiction(self):
        b=copy.deepcopy(self.bundle); other=copy.deepcopy(b['entry'][-1]);other['resource']['valueQuantity']['value']=9;b['entry'].append(other)
        self.assertTrue(all(not x['usable'] for x in self.profile(b)['observations']))
    def test_matching_missing_unit_and_provenance(self):
        parsed=parse_deterministic('DEMO','Inclusion Criteria:\nHbA1c >= 7.0% within 90 days.')
        result=match_normalized(parsed,self.profile())
        self.assertEqual(result['criteria'][0]['status'],'MET')
        self.assertTrue(result['criteria'][0]['provenance'])
        b=copy.deepcopy(self.bundle);b['entry'][-1]['resource']['valueQuantity']['unit']='mg/dL';b['entry'][-1]['resource']['valueQuantity']['code']='mg/dL'
        self.assertEqual(match_normalized(parsed,self.profile(b))['criteria'][0]['status'],'UNKNOWN')
    def test_exclusion_conflict(self):
        parsed=parse_deterministic('DEMO','Exclusion Criteria:\nDiagnosis of type 2 diabetes.')
        self.assertEqual(match_normalized(parsed,self.profile())['outcome'],'Potentially Ineligible')
    def test_missing_diagnosis(self):
        b=copy.deepcopy(self.bundle);b['entry']=[b['entry'][0]]
        parsed=parse_deterministic('DEMO','Inclusion Criteria:\nDiagnosis of type 2 diabetes.')
        self.assertEqual(match_normalized(parsed,self.profile(b))['outcome'],'Needs More Information')
    def test_shorter_time_window(self):
        parsed=parse_deterministic('DEMO','Inclusion Criteria:\nHbA1c >= 7.0% within 2 days.')
        self.assertEqual(match_normalized(parsed,self.profile())['criteria'][0]['status'],'UNKNOWN')
    def test_compound_diagnosis_is_unknown(self):
        parsed=parse_deterministic('DEMO','Inclusion Criteria:\nDiagnosis of type 2 diabetes or asthma.')
        self.assertEqual(match_normalized(parsed,self.profile())['outcome'],'Needs More Information')
    def test_medication_reference(self):
        b=copy.deepcopy(self.bundle)
        b['entry'].append({'fullUrl':'urn:uuid:med','resource':{'resourceType':'Medication','id':'med','code':{'text':'Metformin'}}})
        b['entry'][2]['resource'].pop('medicationCodeableConcept')
        b['entry'][2]['resource']['medicationReference']={'reference':'urn:uuid:med'}
        self.assertEqual(self.profile(b)['medications'][0]['medication_source']['entry_index'],len(b['entry'])-1)

if __name__=='__main__': unittest.main()
