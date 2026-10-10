import copy
import unittest
from datetime import date
from pydantic import ValidationError
from app.demo import run_demo, snapshots
from app.eligibility_parser import parse_deterministic
from app.eligibility_matcher import SyntheticProfile, match_parsed_eligibility, _as_date
from app.synthetic_patients import import_bundle, match_normalized


class QARegressionTests(unittest.TestCase):
    def match(self, text, **profile):
        return match_parsed_eligibility(parse_deterministic('QA', text), SyntheticProfile(profile_id='SYN-QA', **profile), evaluation_date=date(2026, 10, 10)).criteria[0].status

    def test_mixed_age_and_diagnosis_cannot_be_reduced_to_age(self):
        self.assertEqual(self.match('Age 18 to 75 years and diagnosis of asthma.', age=50, conditions=[]), 'UNKNOWN')

    def test_mixed_condition_and_medication_cannot_be_reduced(self):
        self.assertEqual(self.match('Diagnosis of diabetes and treatment with insulin.', conditions=['diabetes']), 'UNKNOWN')

    def test_mixed_negation_requires_review(self):
        self.assertEqual(self.match('Diagnosis of cancer and no asthma.', conditions=['cancer','asthma']), 'UNKNOWN')

    def test_manual_rule_cannot_be_satisfied_by_generic_fact(self):
        self.assertEqual(self.match('Investigator judgement of fitness.', facts={'uncertain':True}), 'UNKNOWN')

    def test_future_lab_is_unknown(self):
        self.assertEqual(self.match('HbA1c >= 7.0% within 90 days.', labs=[dict(name='HbA1c',value=8,unit='%',date='2027-01-01')]), 'UNKNOWN')

    def test_empty_or_partial_diagnosis_is_not_positive_evidence(self):
        for condition in ['', 'asth']:
            self.assertEqual(self.match('Diagnosis of asthma.', conditions=[condition]), 'UNKNOWN')

    def test_future_medication_dates_do_not_establish_exposure(self):
        self.assertEqual(self.match('Insulin treatment.', medications=[dict(name='Insulin',status='current',start_date='2027-01-01')],medications_complete=True), 'UNKNOWN')

    def test_missing_threshold_units_are_unknown(self):
        self.assertEqual(self.match('Glucose >= 126.', labs=[dict(name='Glucose',value=140,unit='mg/dL')]), 'UNKNOWN')

    def test_invalid_ages_and_nonfinite_labs_are_rejected(self):
        for age in [-1,121]:
            with self.assertRaises(ValidationError): SyntheticProfile(profile_id='bad',age=age)
        with self.assertRaises(ValidationError):
            SyntheticProfile(profile_id='bad',labs=[dict(name='Glucose',value=float('inf'))])

    def test_date_helper(self):
        self.assertEqual(_as_date('2026-10-10'),date(2026,10,10))

    def test_all_cached_trials_compute_fresh_results_deterministically(self):
        for record in snapshots()['records']:
            nct=record['protocolSection']['identificationModule']['nctId']
            first=run_demo(nct); second=run_demo(nct)
            self.assertEqual(first,second)
            self.assertEqual(len(first['matches']),3)
            for match in first['matches']:
                self.assertEqual(sum(match['counts'].values()),len(match['criteria']))
                self.assertTrue(all(row['original_text'] in first['original_eligibility'] for row in match['criteria']))

    def test_mutating_profile_changes_computed_match(self):
        from pathlib import Path
        import json
        bundle=json.loads((Path(__file__).parents[1]/'app/data/synthetic_demo.json').read_text())[0]
        parsed=parse_deterministic('QA','Age 18 to 75 years.')
        original=match_normalized(parsed,import_bundle(bundle,True,date(2026,10,10)))
        changed=copy.deepcopy(bundle);changed['entry'][0]['resource']['birthDate']='2015-01-01'
        updated=match_normalized(parsed,import_bundle(changed,True,date(2026,10,10)))
        self.assertEqual(original['criteria'][0]['status'],'MET')
        self.assertEqual(updated['criteria'][0]['status'],'NOT_MET')

    def test_fhir_medication_is_connected_to_matcher(self):
        from pathlib import Path
        import json
        bundle=json.loads((Path(__file__).parents[1]/'app/data/synthetic_demo.json').read_text())[0]
        profile=import_bundle(bundle,True,date(2026,10,10))
        result=match_normalized(parse_deterministic('QA','Metformin treatment.'),profile)
        self.assertEqual(result['criteria'][0]['status'],'MET')
        self.assertTrue(result['criteria'][0]['provenance'])

    def test_age_before_and_on_birthday(self):
        from pathlib import Path
        import json
        bundle=json.loads((Path(__file__).parents[1]/'app/data/synthetic_demo.json').read_text())[0]
        bundle['entry'][0]['resource']['birthDate']='2000-10-11'
        self.assertEqual(import_bundle(bundle,True,date(2026,10,10))['age'],25)
        self.assertEqual(import_bundle(bundle,True,date(2026,10,11))['age'],26)
