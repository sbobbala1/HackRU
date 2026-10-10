# Patient trial explainer

Open **Trial explainer** in the patient sidebar, search a condition or enter an NCT ID, and select a real ClinicalTrials.gov study. Official study details also offer an **Ask the trial explainer** link. Three sample questions explain purpose, participation requirements, and study activities. Free-text questions additionally support visits, risks/burdens, and unclear eligibility wording.

The browser preserves the full official `protocolSection`. Answers cite specific field paths and exact excerpts with the official record URL and retrieval time. Visit counts are never derived from outcome time frames or study duration. Missing risk descriptions never mean there are no risks. General definitions are labeled separately. The source-based mode is conservative excerpt retrieval, not a generated medical explanation.

## Optional AI simplification

Run the backend and configure `OPENAI_API_KEY` in `backend/.env` to use the opt-in AI checkbox. `OPENAI_EXPLAINER_MODEL` defaults to `gpt-4o-mini`, following the existing project model configuration. The API key stays on the server. Only public trial excerpts and a supported topic are sent to the model, never patient profiles or the user's free-text question. The backend independently retrieves the official record and verifies each excerpt before making a model request. The model uses strict structured output, and the application validates citation IDs, unchanged source quotes, numerical quantities, and personal-advice claims. Failures, refusals, or validation problems return source-only mode.

AI paraphrases are explicitly labeled and original excerpts remain visible. Citation checks do not prove that every paraphrase preserves meaning; readers should verify against the displayed original and study team. The demo does not establish eligibility, recommend treatment, promise safety, or translate unsupported languages. English is the supported language. Unclear-criteria detection is a conservative wording heuristic, not exhaustive protocol interpretation.

## Verification

From the root: `node --test tests/trialExplainer.test.js` and `npm.cmd run build`.
From `backend`: `python -m unittest discover -s tests`.

Tests cover unsupported questions, missing fields, missing visits/risks, citation provenance, unsupported languages, fabricated AI quantities, altered quotes, personal advice, unverified source excerpts, and API failure fallback. AI responses are mocked in tests, so live model behavior requires a configured key and manual review.

Structured output implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
