"""Synthetic-only FHIR R4 extraction. Raw identity fields are never returned."""
import hashlib
import math
from datetime import date, datetime, timezone
from .eligibility_matcher import SyntheticProfile, match_parsed_eligibility


def day(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def normalize_quantity(code, value, unit):
    """Only explicit analyte-specific conversions; retain original quantity."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError('Quantity must be a finite number')
    unit = str(unit or '').lower()
    if code in ('2345-7', '2339-0') and unit == 'mmol/l':
        return value * 18.0182, 'mg/dl', 'Glucose mmol/L × 18.0182 = mg/dL'
    if unit in ('%', 'mg/dl', 'mmol/l', 'iu/l'):
        return value, unit, 'No conversion'
    return value, unit, 'Unsupported unit: retained, unavailable for matching'


def import_bundle(bundle, synthetic_attested=False, as_of=None):
    if not synthetic_attested:
        raise ValueError('Confirm that the file contains synthetic records only')
    if not isinstance(bundle, dict) or bundle.get('resourceType') != 'Bundle':
        raise ValueError('Expected a FHIR R4 Bundle')
    entries = bundle.get('entry')
    if not isinstance(entries, list) or len(entries) > 10000:
        raise ValueError('Bundle entries must be a list of at most 10000 resources')
    resources = [(i, e.get('resource')) for i, e in enumerate(entries) if isinstance(e, dict) and isinstance(e.get('resource'), dict)]
    patients = [(i, r) for i, r in resources if r.get('resourceType') == 'Patient']
    if len(patients) != 1:
        raise ValueError('Import one patient per Bundle')
    index, patient = patients[0]
    patient_id = patient.get('id')
    if not isinstance(patient_id, str) or not patient_id:
        raise ValueError('Patient resource needs an id for reference resolution')
    today = as_of or datetime.now(timezone.utc).date()
    digest = hashlib.sha256(__import__('json').dumps(bundle, sort_keys=True).encode()).hexdigest()
    profile = dict(profile_id='SYN-' + digest[:12].upper(), synthetic=True, source_hash=digest,
                   as_of=today.isoformat(), age=None, conditions=[], medications=[], procedures=[], observations=[], warnings=[])
    def source(i, r, path):
        return dict(bundle_hash=digest, resource_type=r['resourceType'], entry_index=i,
                    path=f'entry[{i}].resource.{path}')
    born = day(patient.get('birthDate'))
    profile['age_source'] = source(index, patient, 'birthDate')
    if born and born <= today:
        age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
        if age <= 120:
            profile['age'] = age
    if profile['age'] is None:
        profile['warnings'].append('Missing or invalid birth date; age remains unknown')
    aliases = {'Patient/' + patient_id, patient_id}
    if entries[index].get('fullUrl'):
        aliases.add(entries[index]['fullUrl'])
    def concept(value):
        if not isinstance(value, dict):
            return '', ''
        coding = value.get('coding') or []
        if not isinstance(coding, list): coding = []
        first = next((x for x in coding if isinstance(x, dict)), {})
        return str(first.get('display') or value.get('text') or first.get('code') or ''), str(first.get('code') or '')
    for i, r in resources:
        kind = r.get('resourceType')
        if kind not in ('Condition', 'MedicationRequest', 'MedicationStatement', 'Procedure', 'Observation'):
            continue
        subject = r.get('subject') or {}
        if not isinstance(subject, dict) or subject.get('reference') not in aliases:
            profile['warnings'].append(f'Entry {i}: unresolved or different patient reference; skipped')
            continue
        field = 'medicationCodeableConcept' if kind.startswith('Medication') else 'code'
        medication = r.get('medicationReference')
        if medication and isinstance(medication, dict):
            ref = medication.get('reference')
            found = next(((j, v) for j, v in resources if v.get('resourceType') == 'Medication' and
                             ref in (entries[j].get('fullUrl'), 'Medication/' + str(v.get('id')))), None)
            resolved = found[1] if found else None
            label, code = concept(resolved.get('code') if resolved else None)
            med_source = source(found[0], resolved, 'code') if resolved else None
        else:
            label, code = concept(r.get(field)); med_source = None
        stamp = r.get('effectiveDateTime') or r.get('onsetDateTime') or r.get('performedDateTime') or r.get('authoredOn')
        item = dict(label=label or 'Unspecified', code=code, date=stamp, source=source(i, r, field),
                    date_source=source(i, r, 'effectiveDateTime/onsetDateTime/performedDateTime/authoredOn'))
        if med_source:
            item['medication_source'] = med_source
        if kind == 'Observation':
            parts = r.get('component') or [r]
            if not isinstance(parts, list):
                profile['warnings'].append(f'Entry {i}: malformed observation components'); continue
            for n, part in enumerate(parts):
                if not isinstance(part, dict): continue
                name, obs_code = concept(part.get('code'))
                prefix = f'component[{n}].' if r.get('component') else ''
                obs = dict(item, label=name or 'Unspecified', code=obs_code, value=None, unit=None,
                           original_value=None, original_unit=None, usable=False,
                           source=source(i, r, prefix+'valueQuantity'), code_source=source(i, r, prefix+'code'))
                quantity = part.get('valueQuantity') or {}
                try:
                    value = quantity.get('value'); unit = quantity.get('code') or quantity.get('unit')
                    obs.update(original_value=value, original_unit=unit)
                    normalized, normalized_unit, conversion = normalize_quantity(obs_code, value, unit)
                    observed = day(stamp)
                    valid = observed is not None and 0 <= (today-observed).days <= 90
                    valid = valid and r.get('status') in ('final', 'amended', 'corrected') and not conversion.startswith('Unsupported') and not quantity.get('comparator')
                    obs.update(value=normalized, unit=normalized_unit, conversion=conversion, usable=valid)
                    if not valid: obs['issue'] = 'Missing, future, older than 90 days, non-final, or unsupported-unit observation'
                except (ValueError, AttributeError):
                    obs['issue'] = 'Missing or malformed quantity'
                profile['observations'].append(obs)
        else:
            key = 'conditions' if kind == 'Condition' else 'procedures' if kind == 'Procedure' else 'medications'
            item['status'] = r.get('status') or concept(r.get('clinicalStatus'))[1]
            item['status_source'] = source(i, r, 'status/clinicalStatus')
            profile[key].append(item)
    for obs in profile['observations']:
        peers = [x for x in profile['observations'] if x['code'] == obs['code'] and x['date'] == obs['date'] and x['usable']]
        if obs['usable'] and len({(x['value'], x['unit']) for x in peers}) > 1:
            for x in peers:
                x.update(usable=False, issue='Contradictory observations at the same date')
    return profile


def match_normalized(parsed, profile):
    labs = []; evidence = {}
    for c in parsed.laboratory_thresholds:
        key = (c.requirement or '').replace(' ', '').lower()
        aliases = {'hba1c': ('4548-4',), 'glucose': ('2345-7', '2339-0')}
        candidates = [o for o in profile['observations'] if o['usable'] and
                      (o['code'] in aliases.get(key, ()) or o['label'].replace(' ', '').lower() == key) and
                      o['unit'] == (c.unit or '').lower()]
        if c.time_window:
            import re
            window = re.fullmatch(r'(\d+) (days?|weeks?|months?|years?)', c.time_window)
            if window:
                days = int(window[1]) * {'day':1,'week':7,'month':30,'year':365}[window[2].rstrip('s')]
                candidates = [o for o in candidates if (day(profile['as_of'])-day(o['date'])).days <= days]
            else: candidates = []
        if candidates:
            selected = max(candidates, key=lambda o: o['date'])
            labs.append(dict(name=c.requirement, value=selected['value'], unit=selected['unit'], date=selected['date'])); evidence[c.original_text] = selected
    conditions = [x['label'] for x in profile['conditions'] if x['status'] == 'active']
    result = match_parsed_eligibility(parsed, SyntheticProfile(profile_id=profile['profile_id'], age=profile['age'], conditions=conditions, labs=labs), evaluation_date=day(profile['as_of']))
    rows = result.model_dump()
    for row in rows['criteria']:
        row['status'] = row['status'].replace(' ', '_')
    compound_texts = {c.original_text for c in parsed.criteria if c.logic in ('AND','OR','unknown')}
    for row in rows['criteria']:
        if row['original_text'] in compound_texts:
            row.update(status='UNKNOWN', explanation='Compound logic requires manual review.', manual_review=True)
    for row in rows['criteria']:
        row['provenance'] = [evidence[row['original_text']]] if row['original_text'] in evidence else [profile['age_source']] if row['criterion_type']=='age' else profile['conditions'] if row['criterion_type']=='diagnosis' else []
    rows['counts'] = {s:sum(r['status']==s for r in rows['criteria']) for s in ('MET','NOT_MET','UNKNOWN')}
    rows['outcome'] = 'Potentially Ineligible' if rows['counts']['NOT_MET'] else 'Needs More Information' if rows['counts']['UNKNOWN'] or not rows['criteria'] else 'Potential Match'
    return rows
