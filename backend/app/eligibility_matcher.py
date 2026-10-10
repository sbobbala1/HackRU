"""Deterministic matching of a synthetic profile against parsed criteria."""
from typing import Literal
from pydantic import BaseModel, Field
from .eligibility_parser import ParsedEligibility, Criterion

Status = Literal['MET', 'NOT_MET', 'UNKNOWN']

class SyntheticProfile(BaseModel):
    profile_id: str
    age: int | None = None
    conditions: list[str] = Field(default_factory=list)
    medications: list[str] | None = None
    labs: dict[str, float] | None = None

class MatchRow(BaseModel):
    original_text: str
    criterion_type: str
    status: Status
    profile_evidence: str
    explanation: str
    manual_review: bool = False

class ParsedMatch(BaseModel):
    profile_id: str
    study_id: str
    outcome: Literal['Potential Match', 'Needs More Information', 'Potentially Ineligible']
    counts: dict[Status, int]
    criteria: list[MatchRow]
    disclaimer: str = 'Preliminary comparison only. Official clinical screening determines eligibility.'

def _age(c: Criterion, age: int | None) -> MatchRow:
    if age is None: return MatchRow(original_text=c.original_text, criterion_type='age', status='UNKNOWN', profile_evidence='Age not provided', explanation='Age is needed to evaluate this rule.')
    met = age >= c.value if c.operator == '>=' else age <= c.value
    return MatchRow(original_text=c.original_text, criterion_type='age', status='MET' if met else 'NOT_MET', profile_evidence=f'Age: {age}', explanation='Profile age satisfies the stated age bound.' if met else 'Profile age conflicts with the stated age bound.')

def match_parsed_eligibility(parsed: ParsedEligibility, profile: SyntheticProfile) -> ParsedMatch:
    rows: list[MatchRow] = []
    if parsed.minimum_age: rows.append(_age(parsed.minimum_age, profile.age))
    if parsed.maximum_age: rows.append(_age(parsed.maximum_age, profile.age))
    for c in parsed.required_diagnoses:
        text = c.original_text.lower(); known = [x.lower() for x in profile.conditions]
        topics = [x for x in ('type 2 diabetes', 'asthma', 'osteoarthritis', 'cancer') if x in text]
        if not topics: rows.append(MatchRow(original_text=c.original_text, criterion_type='diagnosis', status='UNKNOWN', profile_evidence=', '.join(profile.conditions) or 'Conditions not provided', explanation='The diagnosis wording needs manual review.', manual_review=True))
        elif any(t in known for t in topics): rows.append(MatchRow(original_text=c.original_text, criterion_type='diagnosis', status='MET', profile_evidence=', '.join(profile.conditions), explanation='The explicitly named condition appears in the synthetic profile.'))
        else: rows.append(MatchRow(original_text=c.original_text, criterion_type='diagnosis', status='UNKNOWN', profile_evidence=', '.join(profile.conditions) or 'Conditions not provided', explanation='Absence from an incomplete condition list does not establish absence of a diagnosis.'))
    for c in parsed.laboratory_thresholds:
        key = (c.requirement or '').replace(' ', '').lower(); values = {k.replace(' ', '').lower(): v for k, v in (profile.labs or {}).items()}
        value = values.get(key)
        if value is None: rows.append(MatchRow(original_text=c.original_text, criterion_type='laboratory', status='UNKNOWN', profile_evidence='Compatible result not provided', explanation='No compatible supplied laboratory result.', manual_review=True))
        else:
            met = value >= c.value if c.operator == '>=' else value <= c.value if c.operator == '<=' else None
            rows.append(MatchRow(original_text=c.original_text, criterion_type='laboratory', status='UNKNOWN' if met is None else 'MET' if met else 'NOT_MET', profile_evidence=f'{c.requirement}: {value} {c.unit or ""}', explanation='Unsupported threshold requires review.' if met is None else 'Value satisfies the supported threshold.' if met else 'Value conflicts with the supported threshold.', manual_review=met is None))
    for c in [*parsed.inclusion_criteria, *parsed.exclusion_criteria]:
        if c.needs_manual_review and c.category not in ('age',): rows.append(MatchRow(original_text=c.original_text, criterion_type=c.category, status='UNKNOWN', profile_evidence='No deterministic evaluation', explanation='This criterion needs manual review; no assumption was made.', manual_review=True))
    counts = {s: sum(r.status == s for r in rows) for s in ('MET','NOT_MET','UNKNOWN')}
    outcome = 'Potentially Ineligible' if counts['NOT_MET'] else 'Needs More Information' if counts['UNKNOWN'] else 'Potential Match'
    return ParsedMatch(profile_id=profile.profile_id, study_id=parsed.study_id, outcome=outcome, counts=counts, criteria=rows)
