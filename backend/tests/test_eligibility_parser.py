import unittest
from datetime import date

from app.eligibility_parser import parse_deterministic
from app.eligibility_matcher import LabResult, MedicationEvidence, SyntheticProfile, match_parsed_eligibility, rank_profiles


class MatchingEngineTests(unittest.TestCase):
    def test_clear_match_requires_all_explicit_criteria(self):
        parsed = parse_deterministic('NCT00000001', 'Inclusion Criteria:\nAge 18 to 75 years.\nDiagnosis of type 2 diabetes.')
        profile = SyntheticProfile(profile_id='SYN-1', age=52, conditions=['type 2 diabetes'], conditions_complete=True)
        result = match_parsed_eligibility(parsed, profile, evaluation_date=date(2026, 10, 10))
        self.assertEqual(result.outcome, 'Potential Match')
        self.assertEqual([x.status for x in result.criteria], ['MET', 'MET'])
        self.assertIn('not a probability', result.prioritization_heuristic)

    def test_exclusion_conflict_is_visible_and_category_conflict(self):
        parsed = parse_deterministic('NCT00000002', 'Exclusion Criteria:\nType 1 diabetes.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-2', conditions=['type 1 diabetes']))
        self.assertEqual(result.criteria[0].status, 'NOT MET')
        self.assertEqual(result.outcome, 'Criteria Conflict')

    def test_borderline_age_boundaries_are_inclusive(self):
        parsed = parse_deterministic('NCT00000003', 'Inclusion Criteria:\nAge 18 to 75 years.')
        for age in (18, 75):
            self.assertEqual(match_parsed_eligibility(parsed, SyntheticProfile(profile_id=f'SYN-{age}', age=age)).criteria[0].status, 'MET')
        self.assertEqual(match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-76', age=76)).criteria[0].status, 'NOT MET')

    def test_missing_lab_is_unknown_not_met(self):
        parsed = parse_deterministic('NCT00000004', 'Inclusion Criteria:\nHbA1c >= 7.0%.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-4'))
        self.assertEqual(result.criteria[0].status, 'UNKNOWN')
        self.assertEqual(result.outcome, 'Needs More Information')
        self.assertTrue(result.missing_information)

    def test_lab_threshold_and_exact_boundary(self):
        parsed = parse_deterministic('NCT00000005', 'Inclusion Criteria:\nHbA1c >= 7.0%.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-5', labs=[LabResult(name='A1c', value=7, unit='%')]))
        self.assertEqual(result.criteria[0].status, 'MET')

    def test_lab_range_and_sustained_duration(self):
        within_range = parse_deterministic('NCT00000017', 'Inclusion Criteria:\nHbA1c between 7.0% and 9.5%.')
        self.assertEqual(within_range.criteria[0].upper_value, 9.5)
        result = match_parsed_eligibility(within_range, SyntheticProfile(profile_id='SYN-RANGE', labs=[LabResult(name='HbA1c', value=8.0, unit='%', date=date(2026, 10, 1))]))
        self.assertEqual(result.criteria[0].status, 'MET')

        sustained = parse_deterministic('NCT00000018', 'Inclusion Criteria:\nHbA1c >= 7.0% for 90 days.')
        insufficient = SyntheticProfile(profile_id='SYN-TREND-UNKNOWN', labs=[LabResult(name='HbA1c', value=8.0, unit='%', date=date(2026, 9, 15))])
        sufficient = SyntheticProfile(profile_id='SYN-TREND-MET', labs=[LabResult(name='HbA1c', value=8.0, unit='%', date=date(2026, 6, 1)), LabResult(name='HbA1c', value=8.2, unit='%', date=date(2026, 10, 1))])
        self.assertEqual(match_parsed_eligibility(sustained, insufficient, evaluation_date=date(2026, 10, 10)).criteria[0].status, 'UNKNOWN')
        self.assertEqual(match_parsed_eligibility(sustained, sufficient, evaluation_date=date(2026, 10, 10)).criteria[0].status, 'MET')

    def test_age_missing_does_not_claim_conflict(self):
        parsed = parse_deterministic('NCT00000006', 'Inclusion Criteria:\nAge 18 to 75 years.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-6'))
        self.assertEqual(result.criteria[0].status, 'UNKNOWN')

    def test_undocumented_condition_is_unknown_even_with_empty_list(self):
        parsed = parse_deterministic('NCT00000007', 'Inclusion Criteria:\nDiagnosis of asthma.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-7', conditions=[]))
        self.assertEqual(result.criteria[0].status, 'UNKNOWN')

    def test_complete_condition_inventory_can_support_absence_for_exclusion(self):
        parsed = parse_deterministic('NCT00000008', 'Exclusion Criteria:\nType 1 diabetes.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-8', conditions=['type 2 diabetes'], conditions_complete=True))
        self.assertEqual(result.criteria[0].status, 'MET')

    def test_contradictory_condition_data_is_unknown(self):
        parsed = parse_deterministic('NCT00000009', 'Inclusion Criteria:\nDiagnosis of type 2 diabetes.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-9', conditions=['type 2 diabetes', 'No type 2 diabetes']))
        self.assertEqual(result.criteria[0].status, 'UNKNOWN')
        self.assertIn('reconcile', result.criteria[0].missing_information[0])

    def test_excluded_current_medication_conflict_and_missing_inventory_unknown(self):
        parsed = parse_deterministic('NCT00000010', 'Exclusion Criteria:\nSystemic corticosteroids.')
        conflict = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-10', medications=[MedicationEvidence(name='Prednisone')]))
        unknown = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-11', medications=None))
        self.assertEqual(conflict.criteria[0].status, 'NOT MET')
        self.assertEqual(unknown.criteria[0].status, 'UNKNOWN')

    def test_or_logic_is_retained(self):
        parsed = parse_deterministic('NCT00000011', 'Inclusion Criteria:\nDiagnosis of asthma or cancer.')
        self.assertEqual(parsed.criteria[0].logic, 'OR')
        self.assertEqual(parsed.criteria[0].alternatives, ['asthma', 'cancer'])
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-OR', conditions=['cancer']))
        self.assertEqual(result.criteria[0].status, 'MET')

    def test_compatible_glucose_units_are_converted(self):
        parsed = parse_deterministic('NCT00000013', 'Inclusion Criteria:\nFasting glucose >= 126 mg/dL.')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-UNIT', labs=[LabResult(name='glucose', value=7.0, unit='mmol/L')]))
        self.assertEqual(result.criteria[0].status, 'MET')

    def test_medication_or_requirement_checks_both_alternatives(self):
        parsed = parse_deterministic('NCT00000014', 'Inclusion Criteria:\nMetformin or insulin treatment.')
        self.assertEqual(parsed.criteria[0].alternatives, ['metformin', 'insulin'])
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-MEDS', medications=['insulin']))
        self.assertEqual(result.criteria[0].status, 'MET')

    def test_medication_window_and_required_duration_use_dates(self):
        evaluation_day = date(2026, 10, 10)
        recent = parse_deterministic('NCT00000015', 'Exclusion Criteria:\nSystemic corticosteroids within 30 days.')
        recent_use = SyntheticProfile(profile_id='SYN-RECENT', medications=[MedicationEvidence(name='Prednisone', status='past', end_date=date(2026, 10, 1))], medication_history_complete=True)
        old_use = SyntheticProfile(profile_id='SYN-OLD', medications=[MedicationEvidence(name='Prednisone', status='past', end_date=date(2026, 7, 1))], medication_history_complete=True)
        self.assertEqual(match_parsed_eligibility(recent, recent_use, evaluation_date=evaluation_day).criteria[0].status, 'NOT MET')
        self.assertEqual(match_parsed_eligibility(recent, old_use, evaluation_date=evaluation_day).criteria[0].status, 'MET')

        duration = parse_deterministic('NCT00000016', 'Inclusion Criteria:\nStable dose of dulaglutide for 6 months.')
        established = SyntheticProfile(profile_id='SYN-DURATION', medications=[MedicationEvidence(name='Dulaglutide', start_date=date(2025, 1, 1))])
        no_start = SyntheticProfile(profile_id='SYN-NODATE', medications=['Dulaglutide'])
        self.assertEqual(match_parsed_eligibility(duration, established, evaluation_date=evaluation_day).criteria[0].status, 'MET')
        self.assertEqual(match_parsed_eligibility(duration, no_start, evaluation_date=evaluation_day).criteria[0].status, 'UNKNOWN')

    def test_explicit_negation_is_evaluated_literally(self):
        parsed = parse_deterministic('NCT00000019', 'Inclusion Criteria:\nNo systemic corticosteroids within 30 days.')
        no_recent_use = SyntheticProfile(profile_id='SYN-NONE', medications=[], medications_complete=True, medication_history_complete=True)
        recent_use = SyntheticProfile(profile_id='SYN-RECENT', medications=[MedicationEvidence(name='Prednisone', status='past', end_date=date(2026, 10, 1))], medication_history_complete=True)
        self.assertEqual(match_parsed_eligibility(parsed, no_recent_use, evaluation_date=date(2026, 10, 10)).criteria[0].status, 'MET')
        self.assertEqual(match_parsed_eligibility(parsed, recent_use, evaluation_date=date(2026, 10, 10)).criteria[0].status, 'NOT MET')

    def test_ambiguous_compound_medication_rule_stays_unknown(self):
        parsed = parse_deterministic('NCT00000020', 'Inclusion Criteria:\nNo treatment with metformin, or on a stable dose of insulin.')
        self.assertEqual(parsed.criteria[0].category, 'uncertain')
        result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id='SYN-COMPOUND', medications=['insulin'], medications_complete=True))
        self.assertEqual(result.criteria[0].status, 'UNKNOWN')

    def test_rank_does_not_hide_unknown_or_conflict(self):
        parsed = parse_deterministic('NCT00000012', 'Inclusion Criteria:\nAge 18 to 75 years.\nExclusion Criteria:\nType 1 diabetes.')
        rows = rank_profiles(parsed, [
            SyntheticProfile(profile_id='conflict', age=40, conditions=['type 1 diabetes']),
            SyntheticProfile(profile_id='unknown'),
            SyntheticProfile(profile_id='potential', age=40, conditions=['type 2 diabetes'], conditions_complete=True),
        ])
        self.assertEqual([x.profile_id for x in rows], ['potential', 'unknown', 'conflict'])
        self.assertEqual(rows[-1].criteria[1].status, 'NOT MET')


if __name__ == '__main__':
    unittest.main()
