# Vitra — Hackathon Submission Pack

## Submission description

Clinical-trial listings are public, but their eligibility criteria can be difficult to interpret and compare with incomplete records. Vitra turns ClinicalTrials.gov records into a clearer study-discovery experience and demonstrates a transparent review workflow using fictional FHIR R4 patient data. A conservative parser structures supported criteria; a deterministic matcher reports `MET`, `NOT MET`, or `UNKNOWN` with evidence. Researchers can inspect where a synthetic cohort encounters conflicts or missing information. Optional AI offers reviewer hints and plain-language summaries, while the rules engine remains responsible for match states. Vitra is a prototype for discovery and workflow exploration—not a clinical eligibility decision system.

## 50-word project summary

Vitra makes clinical-trial records easier to explore and demonstrates transparent matching with fictional patient data. It structures supported eligibility criteria, compares them using deterministic rules, and explains met, unmet, and unknown evidence. Researchers can inspect synthetic-cohort bottlenecks, while optional AI provides review hints without deciding eligibility or replacing study teams.

## 30-second pitch

Finding a relevant clinical trial can mean wrestling with dense listings and eligibility language. Vitra makes public ClinicalTrials.gov records easier to explore, then demonstrates how a research team can review criteria against clearly fictional FHIR patient profiles. Our rules engine shows what is met, not met, or still unknown, and highlights where a synthetic cohort runs into barriers. AI can help organize and explain; deterministic rules produce the match states. Vitra supports discovery—it does not decide who is eligible.

## Three technically impressive implemented features

1. **Evidence-aware eligibility review.** A conservative parser retains original criterion wording and structures supported patterns. A separate deterministic matcher compares supported criteria with explicit profile evidence and reports `MET`, `NOT MET`, or `UNKNOWN`; missing or ambiguous evidence is not silently treated as a match.
2. **FHIR R4 synthetic-data pipeline.** The importer accepts one synthetic Patient Bundle, validates and normalizes supported resources, preserves source fingerprints and entry/path provenance, and keeps the import in memory. The workflow lets judges see how interoperability and traceability fit together without using real patient records.
3. **Recruitment Bottleneck Intelligence.** For each criterion, the prototype tallies match outcomes across an explicitly synthetic cohort, calculates burden as `NOT MET + UNKNOWN`, shows the denominator, and ranks the largest synthetic-data barriers. It demonstrates an interpretable analysis pipeline without claiming a real recruitment forecast.

## Why Vitra meaningfully uses clinical-trial data

Vitra uses actual public study records from ClinicalTrials.gov API v2 rather than invented study listings. It presents study identifiers, status, conditions, eligibility text, listed locations, source links, and retrieval context so a user can return to the authoritative record. The eligibility workflow uses trial criteria as the source text for structured review, and its results keep criterion evidence visible. The offline judging route uses dated snapshots of public records so the demonstration remains available without a live API request. Trial and site availability can change, so users must verify details with ClinicalTrials.gov and the study team.

## Boundaries to state during judging

- Bundled profiles are hand-authored fictional examples, not Synthea output or a representative population. Uploaded demo bundles must be synthetic and are processed in memory.
- Parser coverage is limited. Complex or unsupported clauses remain uncertain or need human review.
- Optional AI suggests structure or summarizes existing deterministic results; it does not set match states.
- Bottleneck counts describe only the displayed synthetic examples. They are not measured recruitment barriers, time savings, or clinical outcomes.
- The prototype has not been clinically validated and must not be used for clinical decisions.
