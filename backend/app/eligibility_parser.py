"""Auditable eligibility parsing. Parsing is deliberately separate from matching."""
from __future__ import annotations

import hashlib
import re
from typing import Literal

from pydantic import BaseModel, Field

_PARSE_CACHE: dict[tuple[str, str], 'ParsedEligibility'] = {}

class Criterion(BaseModel):
    category: Literal['inclusion', 'exclusion', 'age', 'diagnosis', 'medication', 'laboratory', 'timing', 'prior_treatment', 'uncertain']
    original_text: str
    requirement: str | None = None
    operator: Literal['>=', '<=', 'between', 'prohibited', 'required', 'unknown'] = 'unknown'
    value: str | float | None = None
    unit: str | None = None
    time_window: str | None = None
    logic: Literal['AND', 'OR', 'single', 'unknown'] = 'unknown'
    needs_manual_review: bool = False

class ParsedEligibility(BaseModel):
    study_id: str
    source_hash: str
    parser: Literal['deterministic', 'llm_structured_output']
    inclusion_criteria: list[Criterion] = Field(default_factory=list)
    exclusion_criteria: list[Criterion] = Field(default_factory=list)
    minimum_age: Criterion | None = None
    maximum_age: Criterion | None = None
    required_diagnoses: list[Criterion] = Field(default_factory=list)
    medication_rules: list[Criterion] = Field(default_factory=list)
    laboratory_thresholds: list[Criterion] = Field(default_factory=list)
    timing_requirements: list[Criterion] = Field(default_factory=list)
    prior_treatments_or_procedures: list[Criterion] = Field(default_factory=list)
    uncertain_criteria: list[Criterion] = Field(default_factory=list)

def parse_deterministic(study_id: str, original_text: str) -> ParsedEligibility:
    """Extract only explicit, straightforward rules; retain all other source text."""
    digest = hashlib.sha256(original_text.encode()).hexdigest()
    cached = _PARSE_CACHE.get((study_id, digest))
    if cached:
        return cached.model_copy(deep=True)
    result = ParsedEligibility(study_id=study_id, source_hash=digest, parser='deterministic')
    if not original_text or not original_text.strip():
        result.uncertain_criteria.append(Criterion(category='uncertain', original_text='No eligibility criteria provided.', needs_manual_review=True))
        _PARSE_CACHE[(study_id, digest)] = result
        return result
    section = 'inclusion'
    for raw in filter(None, (line.strip(' •\t-') for line in original_text.splitlines())):
        low = raw.lower()
        if 'exclusion criteria' in low: section = 'exclusion'; continue
        if 'inclusion criteria' in low: section = 'inclusion'; continue
        logic = 'OR' if re.search(r'\bor\b', low) else 'AND' if re.search(r'\band\b', low) else 'single'
        bucket = result.exclusion_criteria if section == 'exclusion' else result.inclusion_criteria
        criterion = Criterion(category=section, original_text=raw, logic=logic, needs_manual_review=True)
        age = re.search(r'(?:age|aged?)\s*(?:of\s*)?(\d+)\s*(?:to|-|–)\s*(\d+)\s*years?', low)
        min_age = re.search(r'(?:age|aged?)\s*(?:of\s*)?(\d+)\s*(?:years?\s*)?(?:or older|and older|or above)', low)
        max_age = re.search(r'(?:age|aged?)\s*(?:of\s*)?(\d+)\s*(?:years?\s*)?(?:or younger|and younger|or below)', low)
        lab = re.search(r'([a-z][a-z0-9 -]{1,30})\s*(>=|≤|<=|>|<|between)\s*(\d+(?:\.\d+)?)\s*(%|mg/dl|mmol/l|iu/l)', low)
        timing = re.search(r'(?:within|in the previous|during the previous)\s+(\d+\s+(?:day|week|month|year)s?)', low)
        if age:
            lo, hi = age.groups(); result.minimum_age = Criterion(category='age', original_text=raw, requirement='minimum age', operator='>=', value=float(lo), unit='years', logic=logic); result.maximum_age = Criterion(category='age', original_text=raw, requirement='maximum age', operator='<=', value=float(hi), unit='years', logic=logic); criterion.needs_manual_review=False
        elif min_age:
            result.minimum_age = Criterion(category='age', original_text=raw, requirement='minimum age', operator='>=', value=float(min_age.group(1)), unit='years', logic=logic); criterion.needs_manual_review=False
        elif max_age:
            result.maximum_age = Criterion(category='age', original_text=raw, requirement='maximum age', operator='<=', value=float(max_age.group(1)), unit='years', logic=logic); criterion.needs_manual_review=False
        if lab:
            name, op, value, unit = lab.groups(); item = Criterion(category='laboratory', original_text=raw, requirement=name.strip(), operator={'≤':'<='}.get(op, op), value=float(value), unit=unit, time_window=timing.group(1) if timing else None, logic=logic); result.laboratory_thresholds.append(item); criterion.needs_manual_review=False
        if timing and not lab:
            result.timing_requirements.append(Criterion(category='timing', original_text=raw, requirement='explicit timing requirement', time_window=timing.group(1), logic=logic))
        if any(word in low for word in ('diagnosis of', 'diagnosed with', 'diabetes', 'asthma', 'cancer')):
            result.required_diagnoses.append(Criterion(category='diagnosis', original_text=raw, requirement='diagnosis referenced in source text', logic=logic, needs_manual_review=True))
        if any(word in low for word in ('medication', 'drug', 'corticosteroid', 'insulin', 'metformin')):
            result.medication_rules.append(Criterion(category='medication', original_text=raw, requirement='medication language present', operator='prohibited' if section == 'exclusion' else 'required', logic=logic, needs_manual_review=True))
        bucket.append(criterion)
        if criterion.needs_manual_review: result.uncertain_criteria.append(Criterion(category='uncertain', original_text=raw, logic=logic, needs_manual_review=True))
    _PARSE_CACHE[(study_id, digest)] = result
    return result
