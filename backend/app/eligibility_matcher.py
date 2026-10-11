"""Deterministic and auditable synthetic-profile to study matching."""
from __future__ import annotations

import re
from datetime import date as Date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, Field, FiniteFloat

from .eligibility_parser import Criterion, ParsedEligibility

Status = Literal['MET', 'NOT MET', 'UNKNOWN']
Category = Literal['Potential Match', 'Criteria Conflict', 'Needs More Information']


class LabResult(BaseModel):
    name: str
    value: float = Field(allow_inf_nan=False)
    unit: str | None = None
    date: Date | None = None


class MedicationEvidence(BaseModel):
    name: str
    status: Literal['current', 'past', 'unknown'] = 'current'
    start_date: Date | None = None
    end_date: Date | None = None


class SyntheticProfile(BaseModel):
    profile_id: str
    age: int | None = Field(default=None, ge=0, le=120)
    conditions: list[str] | None = None
    conditions_complete: bool = False
    medications: list[str | MedicationEvidence] | None = None
    medications_complete: bool = False
    medication_history_complete: bool = False
    labs: dict[str, FiniteFloat] | list[LabResult] | None = None
    facts: dict[str, str | float | bool | Date | None] = Field(default_factory=dict)


class MatchRow(BaseModel):
    criterion_id: str
    criterion: str
    original_text: str
    section: Literal['inclusion', 'exclusion']
    criterion_type: str
    logic: str
    status: Status
    supporting_patient_fields: list[str] = Field(default_factory=list)
    profile_evidence: str
    explanation: str
    missing_information: list[str] = Field(default_factory=list)
    manual_review: bool = False
    llm_category_suggestion: str | None = None


class ParsedMatch(BaseModel):
    profile_id: str
    study_id: str
    source_url: str | None = None
    outcome: Category
    counts: dict[Status, int]
    criteria: list[MatchRow]
    missing_information: list[str] = Field(default_factory=list)
    prioritization_reasons: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    prioritization_heuristic: str = 'Ordinal review-priority heuristic based on explicit criterion states; not a probability of eligibility.'
    disclaimer: str = 'Preliminary comparison only. This does not establish enrollment eligibility; qualified clinical screening is required.'
    rank: int | None = None
    llm_explanation: str | None = None
    parser: Literal['deterministic', 'llm_structured_output'] = 'deterministic'
    llm_suggestions: list[dict] = Field(default_factory=list)


def _norm(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()


def _alias_match(target: str, value: str) -> bool:
    t, v = _norm(target), _norm(value)
    if not t or not v: return False
    t = re.sub(r'\s+mellitus\b', '', t)
    v = re.sub(r'\s+mellitus\b', '', v)
    aliases = {'type 2 diabetes': ('type 2 diabetes', 'type 2 diabetes mellitus', 't2dm'), 'type 1 diabetes': ('type 1 diabetes', 'type 1 diabetes mellitus', 't1dm'), 'hba1c': ('hba1c', 'a1c', 'glycated hemoglobin'), 'osteoarthritis': ('osteoarthritis', 'osteo arthrosis'), 'corticosteroids': ('corticosteroid', 'prednisone', 'prednisolone', 'dexamethasone', 'methylprednisolone'), 'corticosteroid': ('corticosteroid', 'prednisone', 'prednisolone', 'dexamethasone', 'methylprednisolone'), 'glucocorticoids': ('corticosteroid', 'prednisone', 'prednisolone', 'dexamethasone', 'methylprednisolone')}
    aliases.update({'fasting glucose': ('fasting glucose', 'glucose'), 'blood glucose': ('blood glucose', 'glucose')})
    return any(f' {_norm(a)} ' in f' {v} ' for a in aliases.get(t, (t,)))


def _as_date(value) -> Date | None:
    if isinstance(value, datetime): return value.date()
    if isinstance(value, Date): return value
    if isinstance(value, str):
        try: return Date.fromisoformat(value[:10])
        except ValueError: return None
    return None


def _convert_lab(value: float, source: str | None, target: str | None, analyte: str) -> float | None:
    src = (source or '').lower().replace(' ', '')
    dst = (target or '').lower().replace(' ', '')
    name = _norm(analyte)
    if not dst or not src: return None
    if src == dst: return value
    if name in ('hba1c', 'a1c') and src in ('fraction', 'ratio') and dst == '%' and value <= 1: return value * 100
    if name in ('glucose', 'fasting glucose', 'blood glucose') and src in ('mmol/l', 'mmolperliter') and dst == 'mg/dl': return value * 18.018
    if name in ('glucose', 'fasting glucose', 'blood glucose') and src in ('mg/dl', 'mgdl') and dst == 'mmol/l': return value / 18.018
    if name == 'creatinine' and src in ('umol/l', 'µmol/l') and dst == 'mg/dl': return value / 88.4
    if name == 'creatinine' and src == 'mg/dl' and dst in ('umol/l', 'µmol/l'): return value * 88.4
    return None


def _meets_threshold(value: float, c: Criterion) -> bool | None:
    return value >= c.value if c.operator == '>=' else value <= c.value if c.operator == '<=' else value > c.value if c.operator == '>' else value < c.value if c.operator == '<' else c.value <= value <= c.upper_value if c.operator == 'between' and c.upper_value is not None else None


def _row(c: Criterion, profile: SyntheticProfile, index: int, today: date) -> MatchRow:
    fields: list[str] = []
    missing: list[str] = []
    evidence = 'No relevant synthetic profile field supplied.'
    state: Status = 'UNKNOWN'
    reason = 'Criterion wording or required evidence cannot be evaluated reliably; manual review is needed.'
    requirement = c.requirement or c.category
    exclusion = c.section == 'exclusion'

    if c.needs_manual_review:
        missing = ['manual interpretation of original criterion']
    elif c.category == 'age' and c.value is not None:
        fields = ['age']
        if profile.age is None:
            missing = ['age']; evidence = 'Age not supplied.'; reason = 'Age is required to evaluate this age criterion.'
        else:
            ok = profile.age >= c.value if c.operator == '>=' else profile.age <= c.value if c.operator == '<=' else c.value <= profile.age <= (c.upper_value or c.value) if c.operator == 'between' else None
            if ok is not None:
                state = ('NOT MET' if ok else 'MET') if exclusion else ('MET' if ok else 'NOT MET')
                evidence = f'Age: {profile.age} years.'
                reason = 'Age is within the stated bound.' if state == ('NOT MET' if exclusion else 'MET') else 'Age conflicts with the stated bound.'
    elif c.category == 'diagnosis':
        fields = ['conditions', 'conditions_complete']
        terms = c.alternatives or [requirement]
        provided = profile.conditions or []
        negatives = [v for v in provided if v.lower().startswith(('no ', 'denies ', 'negative for ')) and any(_alias_match(t, v) for t in terms)]
        positives = [v for v in provided if v not in negatives and any(_alias_match(t, v) for t in terms)]
        positive_terms = {t for t in terms if any(_alias_match(t, v) for v in positives)}
        negative_terms = {t for t in terms if any(_alias_match(t, v) for v in negatives)}
        contradictory = positive_terms & negative_terms
        if contradictory:
            evidence = f'Contradictory condition entries: {positives + negatives}.'; reason = 'The profile contains conflicting positive and negative condition evidence.'; missing = ['reconcile contradictory condition entries']
        else:
            all_present = len(positive_terms) == len(terms)
            any_present = bool(positive_terms)
            any_absent = bool(negative_terms) or (profile.conditions_complete and len(positive_terms) < len(terms))
            all_absent = len(negative_terms) == len(terms) or (profile.conditions_complete and not positive_terms)
            criterion_true = (any_present if c.logic == 'OR' else all_present) if c.logic in ('OR', 'AND') else any_present
            criterion_false = (all_absent if c.logic == 'OR' else any_absent) if c.logic in ('OR', 'AND') else all_absent
            if c.negated: criterion_true, criterion_false = criterion_false, criterion_true
            evidence = 'Documented condition(s): ' + (', '.join(positives) if positives else 'none') + (f'; explicit negative(s): {", ".join(negatives)}' if negatives else '') + ('.' if positives or negatives else ' Condition status not documented.')
            if criterion_true:
                state = 'NOT MET' if exclusion else 'MET'; reason = 'The condition logic is explicitly supported by the profile.'
            elif criterion_false:
                state = 'MET' if exclusion else 'NOT MET'; reason = 'The profile documents that the condition logic is not satisfied.'
            else:
                missing = ['condition history']; reason = 'One or more condition operands are not documented; absence is not assumed.'
    elif c.category == 'laboratory':
        fields = ['labs']
        results: list[LabResult] = []
        if isinstance(profile.labs, list): results = profile.labs
        elif isinstance(profile.labs, dict):
            results = [LabResult(name=k, value=float(v), unit=('%' if _norm(k) in ('a1c','hba1c') else None)) for k, v in profile.labs.items() if v is not None]
        matches = [x for x in results if _alias_match(requirement, x.name) and (x.date is None or x.date <= today)]
        if c.time_window and c.time_relation == 'within':
            m = re.search(r'(\d+)\s+(day|week|month|year)', c.time_window)
            cutoff = today - timedelta(days=int(m.group(1)) * {'day': 1, 'week': 7, 'month': 30, 'year': 365}[m.group(2)]) if m else None
            matches = [x for x in matches if x.date is not None and (cutoff is None or x.date >= cutoff)]
        if c.time_window and c.time_relation == 'duration':
            m = re.search(r'(\d+)\s+(day|week|month|year)', c.time_window)
            span = timedelta(days=int(m.group(1)) * {'day': 1, 'week': 7, 'month': 30, 'year': 365}[m.group(2)]) if m else None
            if any(x.date is None for x in matches):
                matches = []
            elif not span or not matches or min(x.date for x in matches) > today - span or max(x.date for x in matches) < today - timedelta(days=30):
                matches = []
        if not matches:
            missing = [f'{requirement} result' + (f' covering {c.time_window}' if c.time_window and c.time_relation == 'duration' else f' within {c.time_window}' if c.time_window else '')]
            evidence = 'No compatible, sufficiently dated laboratory result supplied.'; reason = 'Missing or stale laboratory evidence remains unknown.'
        elif any(len({x.value for x in matches if x.date == d}) > 1 for d in {x.date for x in matches}):
            missing = [f'reconcile conflicting {requirement} results']; evidence = '; '.join(f'{x.value} {x.unit or ""} ({x.date or "date missing"})' for x in matches); reason = 'Multiple conflicting results were supplied; no value was selected.'
        else:
            matches.sort(key=lambda x: x.date or Date.min)
            evaluated = [(_convert_lab(x.value, x.unit, c.unit, requirement), x) for x in (matches if c.time_relation == 'duration' else matches[-1:])]
            if any(v is None for v, _ in evaluated):
                missing = [f'compatible units for {requirement}']; evidence = '; '.join(f'{x.value} {x.unit or "unit missing"}' for _, x in evaluated); reason = 'Units are missing or incompatible and cannot be safely converted.'
            else:
                checks = [_meets_threshold(v, c) for v, _ in evaluated]
                if any(x is None for x in checks):
                    reason = 'The threshold form is unsupported and needs manual review.'
                else:
                    ok = all(checks)
                    result = matches[-1]
                    state = ('NOT MET' if ok else 'MET') if exclusion else ('MET' if ok else 'NOT MET')
                    evidence = '; '.join(f'{x.name}: {x.value} {x.unit or c.unit or ""} on {x.date}' for _, x in evaluated) + '.'
                    reason = 'Measured value(s) satisfy the stated threshold.' if state == ('NOT MET' if exclusion else 'MET') else 'Measured value(s) conflict with the stated threshold.'
    elif c.category == 'medication':
        fields = ['medications', 'medications_complete']
        if c.time_relation == 'within': fields.append('medication_history_complete')
        items = profile.medications or []
        meds = [x if isinstance(x, MedicationEvidence) else MedicationEvidence(name=str(x)) for x in items]
        meds = [m.model_copy(update={'status': 'unknown'}) if
                (m.start_date and m.start_date > today) or (m.end_date and m.end_date > today) or
                (m.start_date and m.end_date and m.start_date > m.end_date) else m for m in meds]
        terms = c.alternatives or [requirement]
        window_match = re.search(r'(\d+)\s+(day|week|month|year)', c.time_window or '')
        window_days = int(window_match.group(1)) * {'day': 1, 'week': 7, 'month': 30, 'year': 365}[window_match.group(2)] if window_match else None
        cutoff = today - timedelta(days=window_days) if window_days is not None else None
        matching_meds = {term: [m for m in meds if _alias_match(term, m.name)] for term in terms}
        if c.time_relation == 'duration':
            hits_by_term = {term: [m for m in matching_meds[term] if m.status == 'current' and m.start_date is not None and window_days is not None and (today-m.start_date).days >= window_days] for term in terms}
        elif c.time_relation == 'within':
            hits_by_term = {term: [m for m in matching_meds[term] if m.status == 'current' or (m.status == 'past' and m.end_date is not None and cutoff is not None and m.end_date >= cutoff)] for term in terms}
        else:
            hits_by_term = {term: [m for m in matching_meds[term] if m.status == 'current'] for term in terms}
        hit_terms = [term for term, hits in hits_by_term.items() if hits]
        uncertain_terms = [term for term in terms if any(m.status == 'unknown' or (c.time_relation == 'duration' and m.status == 'current' and m.start_date is None) or (c.time_relation == 'within' and m.status == 'past' and m.end_date is None) for m in matching_meds[term])]
        known_absent = profile.medication_history_complete if c.time_relation == 'within' else profile.medications_complete
        criterion_true = (bool(hit_terms) if c.logic == 'OR' else len(hit_terms) == len(terms)) if c.logic in ('OR', 'AND') else bool(hit_terms)
        criterion_false = (len(hit_terms) == 0 and known_absent) if c.logic == 'OR' else (len(hit_terms) < len(terms) and known_absent) if c.logic == 'AND' else (len(hit_terms) == 0 and known_absent)
        if uncertain_terms and not criterion_true: criterion_false = False
        if c.negated: criterion_true, criterion_false = criterion_false, criterion_true
        hits = [m for term in hit_terms for m in hits_by_term[term]]
        if criterion_true:
            state = 'NOT MET' if exclusion else 'MET'
            if c.negated:
                evidence = 'Complete medication history supports no matching exposure in the stated window.' if c.time_relation == 'within' else 'Complete medication inventory supports no matching current medication.'
                reason = 'The explicitly negated medication requirement is supported by complete profile data.'
            else:
                evidence = 'Documented medication exposure: ' + ', '.join(dict.fromkeys(m.name for m in hits)) + '.'
                reason = 'A prohibited medication exposure is documented within the stated window.' if exclusion and c.time_relation == 'within' else 'The prohibited medication is explicitly current.' if exclusion else 'The required medication is explicitly current for the stated duration.' if c.time_relation == 'duration' else 'The required medication is explicitly current.'
        elif criterion_false:
            state = 'MET' if exclusion else 'NOT MET'
            if c.negated:
                evidence = 'Documented medication exposure: ' + ', '.join(dict.fromkeys(m.name for m in hits)) + '.'
                reason = 'The explicit no-medication requirement conflicts with documented exposure.'
            else:
                evidence = 'Complete medication history; no matching exposure in the stated window.' if c.time_relation == 'within' else 'Complete medication inventory; target medication not listed.'
                reason = 'Complete medication evidence establishes the target exposure is absent.'
        else:
            missing = ['medication inventory' if c.time_relation != 'within' else 'medication history and exposure dates']
            evidence = 'Medication exposure cannot be established from the supplied fields.'
            reason = 'Medication history is incomplete or missing required dates.'
    else:
        # A small explicit facts vocabulary supports common protocol constraints. Unknown phrases are never guessed.
        fact_key = _norm(requirement)
        facts = {_norm(k): v for k, v in profile.facts.items()}
        value = facts.get(fact_key)
        if value is not None:
            fields = [f'facts.{requirement}']; evidence = f'{requirement}: {value}.'
            truth = value is True or str(value).lower() in ('yes', 'true', '1', 'documented')
            state = ('NOT MET' if truth else 'MET') if exclusion else ('MET' if truth else 'NOT MET')
            reason = 'Explicit synthetic fact evaluated against this criterion.'
        else:
            missing = [requirement]; evidence = 'No matching fact documented.'; reason = 'Criterion requires interpretation or additional patient information.'

    return MatchRow(criterion_id=f'C{index:03}', criterion=requirement, original_text=c.original_text, section=c.section, criterion_type=c.category, logic=c.logic, status=state, supporting_patient_fields=fields, profile_evidence=evidence, explanation=reason, missing_information=missing, manual_review=c.needs_manual_review or state == 'UNKNOWN', llm_category_suggestion=c.llm_category_suggestion)


def match_parsed_eligibility(parsed: ParsedEligibility, profile: SyntheticProfile, source_url: str | None = None, evaluation_date: Date | None = None) -> ParsedMatch:
    today = evaluation_date or Date.today()
    rows = [_row(c, profile, i, today) for i, c in enumerate(parsed.criteria, 1)]
    counts = {s: sum(r.status == s for r in rows) for s in ('MET', 'NOT MET', 'UNKNOWN')}
    # Potential Match means at least one explicit alignment and no known conflict. UNKNOWN rows
    # remain UNKNOWN and are prominently returned for review; this category is not eligibility.
    category: Category = 'Criteria Conflict' if counts['NOT MET'] else 'Potential Match' if counts['MET'] else 'Needs More Information'
    missing = sorted({item for r in rows for item in r.missing_information})
    reasons = [f'{counts["MET"]} criterion/criteria explicitly supported by supplied data.']
    if counts['NOT MET']: reasons.append(f'{counts["NOT MET"]} known criterion conflict(s) remain visible and require review.')
    if counts['UNKNOWN']: reasons.append(f'{counts["UNKNOWN"]} criterion/criteria cannot be evaluated from available data and require review.')
    warnings = ['Synthetic demo data only.', 'Prioritization is not a probability or enrollment eligibility decision.']
    if missing: warnings.append('Potential Match category does not resolve UNKNOWN criteria; candidate needs additional information or manual protocol review.')
    return ParsedMatch(profile_id=profile.profile_id, study_id=parsed.study_id, source_url=source_url, outcome=category, counts=counts, criteria=rows, missing_information=missing, prioritization_reasons=reasons, warnings=warnings)


def rank_profiles(parsed: ParsedEligibility, profiles: list[SyntheticProfile], source_url: str | None = None, evaluation_date: Date | None = None) -> list[ParsedMatch]:
    results = [match_parsed_eligibility(parsed, p, source_url, evaluation_date) for p in profiles]
    order = {'Potential Match': 0, 'Needs More Information': 1, 'Criteria Conflict': 2}
    results.sort(key=lambda x: (order[x.outcome], x.counts['UNKNOWN'], -x.counts['MET'], x.profile_id))
    for i, result in enumerate(results, 1): result.rank = i
    return results
