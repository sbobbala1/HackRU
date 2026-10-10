"""Conservative, deterministic extraction of auditable study criteria."""
from __future__ import annotations

import hashlib
import re
from typing import Literal

from pydantic import BaseModel, Field


class Criterion(BaseModel):
    category: Literal['inclusion', 'exclusion', 'age', 'diagnosis', 'medication', 'laboratory', 'timing', 'prior_treatment', 'uncertain']
    original_text: str
    requirement: str | None = None
    operator: Literal['>=', '<=', '>', '<', 'between', 'prohibited', 'required', 'unknown'] = 'unknown'
    value: str | float | None = None
    upper_value: float | None = None
    unit: str | None = None
    time_window: str | None = None
    time_relation: Literal['within', 'duration', 'unknown'] = 'unknown'
    negated: bool = False
    llm_category_suggestion: str | None = None
    logic: Literal['AND', 'OR', 'single', 'unknown'] = 'unknown'
    section: Literal['inclusion', 'exclusion'] = 'inclusion'
    alternatives: list[str] = Field(default_factory=list)
    needs_manual_review: bool = False


class ParsedEligibility(BaseModel):
    study_id: str
    source_hash: str
    parser: Literal['deterministic', 'llm_structured_output'] = 'deterministic'
    llm_suggestions: list[dict] = Field(default_factory=list)
    criteria: list[Criterion] = Field(default_factory=list)
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


def _criterion(line: str, section: str) -> Criterion:
    low = line.lower()
    logic = 'OR' if re.search(r'\bor\b', low) else 'AND' if re.search(r'\band\b', low) else 'single'
    time = re.search(r'(?:within|in the (?:previous|past)|during the (?:previous|past))\s+(\d+\s+(?:day|week|month|year)s?)', low)
    duration = re.search(r'(?:stable\s+(?:on|dose\s+of)?\s*|for\s+(?:at least\s+)?|at least\s+)(\d+\s+(?:day|week|month|year)s?)', low)
    time_window = time.group(1) if time else duration.group(1) if duration else None
    time_relation = 'within' if time else 'duration' if duration else 'unknown'
    negated = bool(re.search(r'\b(no|without|absence of|free of|negative for|does not have|denies)\b', low))
    if re.search(r'\b(age|aged)\b', low):
        age_range = re.search(r'\b(?:age|aged)\s*(?:of\s*)?(\d+)\s*(?:to|[-–])\s*(\d+)\s*years?', low)
        age_min = re.search(r'(?:age|aged)\s*(?:of\s*)?(?:≥|>=|at least)\s*(\d+)|(?:age|aged)\s*(\d+)\s*(?:years?\s*)?(?:or older|and older|or above)', low)
        age_max = re.search(r'(?:age|aged)\s*(?:of\s*)?(?:≤|<=|at most)\s*(\d+)|(?:age|aged)\s*(\d+)\s*(?:years?\s*)?(?:or younger|and younger|or below)', low)
        if age_range:
            return Criterion(category='age', original_text=line, requirement='age', operator='between', value=float(age_range[1]), upper_value=float(age_range[2]), unit='years', section=section, logic=logic)
        if age_min or age_max:
            m = age_min or age_max
            return Criterion(category='age', original_text=line, requirement='age', operator='>=' if age_min else '<=', value=float(next(v for v in m.groups() if v)), unit='years', section=section, logic=logic)
    # Recognized laboratory/anthropometric measures only; unsupported units stay reviewable.
    analyte = re.search(r'\b(hba1c|a1c|glycated hemoglobin|fasting glucose|blood glucose|glucose|bmi|body mass index|egfr|estimated glomerular filtration rate|creatinine)\b', low)
    threshold = re.search(r'(>=|≥|<=|≤|>|<|between)\s*(\d+(?:\.\d+)?)\s*(%|mg\s*/\s*d?l|mmol\s*/\s*l|kg\s*/\s*m2|ml\s*/\s*min(?:/1\.73\s*m2)?)?(?:\s*(?:to|and|[-–])\s*(\d+(?:\.\d+)?)\s*(%|mg\s*/\s*d?l|mmol\s*/\s*l|kg\s*/\s*m2|ml\s*/\s*min(?:/1\.73\s*m2)?)?)?', low)
    if analyte and threshold:
        symbol, value, unit_first, upper, unit_second = threshold.groups()
        symbol = symbol.replace('≥', '>=').replace('≤', '<=')
        if symbol == 'between' and upper:
            operator = 'between'
        else:
            operator, upper = symbol, None
        name = analyte.group(1).replace('glycated hemoglobin', 'hba1c').replace('body mass index', 'bmi')
        unit = unit_first or unit_second
        return Criterion(category='laboratory', original_text=line, requirement=name, operator=operator, value=float(value), upper_value=float(upper) if upper else None, unit=unit.replace(' ', '') if unit else None, time_window=time_window, time_relation=time_relation, section=section, logic=logic)
    # Positive/negative condition language, retaining the exact source line.
    condition_pattern = r'\b(type\s*[12]\s+diabetes(?: mellitus)?|diabetes(?: mellitus)?|osteoarthritis|asthma|hypertension|cancer|heart failure|chronic kidney disease)\b'
    found_conditions = list(re.finditer(condition_pattern, low))
    anchor = re.search(r'\b(?:diagnosis of|diagnosed with|history of|have|has|with|no|without|denies|absence of|free of)\b', low)
    condition_names = [m.group(1) for m in found_conditions] if found_conditions and (found_conditions[0].start() == 0 or (anchor and anchor.end() <= found_conditions[0].start())) else []
    if condition_names:
        # Normalize duplicate terms but keep all operands for deterministic AND/OR evaluation.
        alternatives = list(dict.fromkeys(condition_names))
        name = ' or '.join(alternatives) if logic == 'OR' else ' and '.join(alternatives)
        return Criterion(category='diagnosis', original_text=line, requirement=name, operator='prohibited' if section == 'exclusion' else 'required', alternatives=alternatives, section=section, logic=logic, negated=negated)
    meds = list(dict.fromkeys(re.findall(r'\b(corticosteroids?|glucocorticoids?|prednisone|prednisolone|insulin|metformin|dulaglutide|tirzepatide|antihyperglycemic medications?|immunosuppressants?)\b', low)))
    if meds:
        if re.search(r'\b(history of|prior to|previously|prior treatment|have been treated|treated with|dose reduction|reduction of dose|past use|exception|short-term)\b|<\s*\d+\s+days?', low):
            return Criterion(category='prior_treatment', original_text=line, requirement='prior medication exposure or dose history', section=section, logic=logic, needs_manual_review=True)
        if negated and logic in ('OR', 'AND') and len(meds) > 1:
            return Criterion(category='uncertain', original_text=line, requirement='complex medication rule', section=section, logic=logic, needs_manual_review=True)
        return Criterion(category='medication', original_text=line, requirement=(' or ' if logic == 'OR' else ' and ').join(meds), operator='prohibited' if section == 'exclusion' else 'required', alternatives=meds, time_window=time_window, time_relation=time_relation, section=section, logic=logic, negated=negated)
    if time:
        return Criterion(category='timing', original_text=line, requirement='time-windowed event or treatment', time_window=time_window, time_relation=time_relation, section=section, logic=logic, needs_manual_review=True)
    category = 'prior_treatment' if any(x in low for x in ('prior treatment', 'previous treatment', 'surgery', 'injection', 'therapy')) else 'uncertain'
    return Criterion(category=category, original_text=line, section=section, logic=logic, needs_manual_review=True)


def parse_deterministic(study_id: str, original_text: str) -> ParsedEligibility:
    digest = hashlib.sha256(original_text.encode()).hexdigest()
    result = ParsedEligibility(study_id=study_id, source_hash=digest, parser='deterministic')
    section = 'inclusion'
    for raw in original_text.splitlines():
        line = raw.strip().lstrip('•-*\t ').strip()
        if not line:
            continue
        low = line.lower()
        if 'exclusion criteria' in low:
            section = 'exclusion'; continue
        if 'inclusion criteria' in low:
            section = 'inclusion'; continue
        c = _criterion(line, section)
        result.criteria.append(c)
        (result.exclusion_criteria if section == 'exclusion' else result.inclusion_criteria).append(c)
        if c.category == 'age':
            if c.operator == 'between':
                result.minimum_age = c.model_copy(update={'operator': '>='})
                result.maximum_age = c.model_copy(update={'operator': '<=', 'value': c.upper_value})
            elif c.operator == '>=': result.minimum_age = c
            elif c.operator == '<=': result.maximum_age = c
        elif c.category == 'diagnosis': result.required_diagnoses.append(c)
        elif c.category == 'medication': result.medication_rules.append(c)
        elif c.category == 'laboratory': result.laboratory_thresholds.append(c)
        elif c.category == 'timing': result.timing_requirements.append(c)
        elif c.category == 'prior_treatment': result.prior_treatments_or_procedures.append(c)
        if c.needs_manual_review: result.uncertain_criteria.append(c)
    if not result.criteria:
        c = Criterion(category='uncertain', original_text='No eligibility criteria provided.', needs_manual_review=True)
        result.criteria.append(c); result.uncertain_criteria.append(c)
    return result
