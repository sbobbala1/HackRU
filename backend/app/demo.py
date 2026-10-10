"""Deterministic judging workflow using cached public trials and fictional FHIR records."""
import json
import re
from datetime import date
from pathlib import Path
from .eligibility_parser import parse_deterministic
from .synthetic_patients import import_bundle, match_normalized

DATA = Path(__file__).parent / 'data'
DEMO_DATE = date(2026, 10, 10)


def snapshots():
    return json.loads((DATA / 'trial_snapshots.json').read_text(encoding='utf-8'))


def cached_record(nct_id):
    record = next((r for r in snapshots()['records'] if r['protocolSection']['identificationModule']['nctId'] == nct_id), None)
    if record is None:
        raise ValueError('This study has no bundled snapshot. Choose one of the three cached demo studies.')
    return record


def eligibility_text(record):
    module = record.get('protocolSection', {}).get('eligibilityModule', {})
    text = module.get('eligibilityCriteria', '')
    # Keep official age metadata auditable and do not mistake months/days for years.
    additional = []
    for field, bound in [('minimumAge', 'or older'), ('maximumAge', 'or younger')]:
        age = re.fullmatch(r'(\d+) Years?', module.get(field, ''), re.I)
        if age: additional.append(f'Age {age[1]} years {bound}.')
    if additional: text += '\nInclusion Criteria:\n' + '\n'.join(additional)
    return text


def run_demo(nct_id):
    record = cached_record(nct_id)
    text = eligibility_text(record)
    parsed = parse_deterministic(nct_id, text)
    bundles = json.loads((DATA / 'synthetic_demo.json').read_text(encoding='utf-8'))
    profiles = [import_bundle(b, True, DEMO_DATE) for b in bundles]
    matches = [match_normalized(parsed, p) for p in profiles]
    return dict(nct_id=nct_id, original_eligibility=text, parsed=parsed.model_dump(), profiles=profiles,
                matches=matches, evaluation_date=DEMO_DATE.isoformat(), cached=True,
                retrieved_at=snapshots()['retrieved_at'], source='Cached ClinicalTrials.gov record; all patients fictional; no LLM request')
