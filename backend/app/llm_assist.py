"""Optional Gemini/OpenAI structured assistance; deterministic code retains state authority."""
from __future__ import annotations

import json
import os


def _client():
    if os.getenv('GEMINI_API_KEY'):
        from .gemini_client import GeminiClient
        return GeminiClient(os.environ['GEMINI_API_KEY'])
    if not os.getenv('OPENAI_API_KEY'):
        return None
    from openai import OpenAI
    return OpenAI()


def suggest_criterion_types(source_text: str) -> list[dict] | None:
    """Suggest line segmentation and categories; callers verify each quote against source."""
    client = _client()
    if client is None:
        return None
    schema = {
        'type': 'object', 'additionalProperties': False, 'required': ['criteria'],
        'properties': {'criteria': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False,
            'required': ['source_text', 'category', 'logic'], 'properties': {
                'source_text': {'type': 'string'},
                'category': {'type': 'string', 'enum': ['age', 'diagnosis', 'medication', 'laboratory', 'timing', 'prior_treatment', 'uncertain']},
                'logic': {'type': 'string', 'enum': ['AND', 'OR', 'single', 'unknown']}
            }}}}
    }
    response = client.responses.create(
        model=os.getenv('OPENAI_MATCHING_MODEL', 'gpt-4o-mini'),
        input=[{'role': 'system', 'content': 'Identify each individual eligibility criterion in the supplied public protocol text. Preserve the exact source line in source_text. Do not decide if a patient meets anything. If category is unclear, use uncertain. Return no extra criteria.'},
               {'role': 'user', 'content': source_text}],
        text={'format': {'type': 'json_schema', 'name': 'criterion_suggestions', 'strict': True, 'schema': schema}},
    )
    return json.loads(response.output_text).get('criteria', [])


def summarize_match(match: dict) -> str | None:
    """Explain existing deterministic results; never produce or change criterion states."""
    client = _client()
    if client is None:
        return None
    schema = {'type': 'object', 'additionalProperties': False, 'required': ['summary'], 'properties': {'summary': {'type': 'string'}}}
    response = client.responses.create(
        model=os.getenv('OPENAI_MATCHING_MODEL', 'gpt-4o-mini'),
        input=[{'role': 'system', 'content': 'Write a concise plain-language explanation of the provided deterministic criterion states. Do not change, infer, or soften any MET, NOT MET, or UNKNOWN state. Never say the person is eligible or likely eligible. Call out conflicts and missing information.'},
               {'role': 'user', 'content': json.dumps(match, default=str)}],
        text={'format': {'type': 'json_schema', 'name': 'match_explanation', 'strict': True, 'schema': schema}},
    )
    summary = json.loads(response.output_text)['summary']
    lowered = summary.lower()
    counts = match.get('counts', {})
    # Fail closed if the generated paraphrase drops an adverse/unknown state or sounds decisive.
    if any(term in lowered for term in ('eligib', 'enroll', 'qualif', 'probability', 'likely')):
        return None
    if counts.get('UNKNOWN', 0) and 'unknown' not in lowered:
        return None
    if counts.get('NOT MET', 0) and 'not met' not in lowered:
        return None
    return summary
