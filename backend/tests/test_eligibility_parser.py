import unittest
from app.eligibility_parser import parse_deterministic
from app.eligibility_matcher import SyntheticProfile, match_parsed_eligibility

class ParserTests(unittest.TestCase):
    def test_age_range(self):
        parsed = parse_deterministic('NCT00000001', 'Inclusion Criteria:\nAge 18 to 75 years.')
        self.assertEqual(parsed.minimum_age.value, 18)
        self.assertEqual(parsed.maximum_age.value, 75)
    def test_lab_and_timing(self):
        parsed = parse_deterministic('NCT00000002', 'Inclusion Criteria:\nHbA1c between 7.0% within 90 days.')
        self.assertEqual(parsed.laboratory_thresholds[0].unit, '%')
        self.assertEqual(parsed.laboratory_thresholds[0].time_window, '90 days')
    def test_exclusion_negation_is_preserved(self):
        text = 'Exclusion Criteria:\nNo systemic corticosteroids within 30 days.'
        parsed = parse_deterministic('NCT00000003', text)
        self.assertIn('No systemic corticosteroids', parsed.exclusion_criteria[0].original_text)
    def test_missing_text(self):
        parsed = parse_deterministic('NCT00000004', '')
        self.assertEqual(len(parsed.uncertain_criteria), 1)
    def test_ambiguous_logic_is_flagged(self):
        parsed = parse_deterministic('NCT00000005', 'Inclusion Criteria:\nClinically stable as judged by investigator.')
        self.assertTrue(parsed.uncertain_criteria[0].needs_manual_review)
    def test_profile_matching_uses_parsed_age(self):
        parsed = parse_deterministic('NCT00000006', 'Inclusion Criteria:\nAge 18 to 75 years.')
        match = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='DEMO-X', age=79))
        self.assertEqual(match.outcome, 'Potentially Ineligible')
        self.assertEqual(match.counts['NOT_MET'], 1)

if __name__ == '__main__': unittest.main()
