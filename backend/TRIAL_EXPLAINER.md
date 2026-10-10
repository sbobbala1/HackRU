# Patient trial explainer

Open **Trial explainer** in the patient sidebar, search a condition or enter an NCT ID, and select a real ClinicalTrials.gov study. Official study details also offer an **Ask the trial explainer** link. Selecting Explain this study generates an overview and clears the search results. Overview, question form, and answer stay in fixed sections without automatic scrolling. Sources are expandable. Failed requests offer retry; changing studies cancels the browser request and ignores late results. Three sample questions explain purpose, participation requirements, and study activities. Arbitrary English questions are sent to AI along with every available field from the selected official protocol, without a keyword gate.

The browser preserves the full official `protocolSection`. Answers cite specific field paths and exact excerpts with the official record URL and retrieval time. Visit counts are never derived from outcome time frames or study duration. Missing risk descriptions never mean there are no risks. General definitions are labeled separately. The source-based mode is conservative excerpt retrieval, not a generated medical explanation.

## Optional AI simplification

Run the backend and configure `OPENAI_API_KEY` in `backend/.env`. AI is used automatically for overviews and questions. `OPENAI_EXPLAINER_MODEL` defaults to `gpt-4o-mini`, following the existing project model configuration. The API key stays on the server. The user's question and all public protocol fields are sent to the model. Patient profiles are not automatically attached. Do not enter real medical records in the question. The backend independently retrieves the official record; it does not trust browser-provided trial descriptions. Each generated factual claim must cite exact field paths and verbatim supporting excerpts, which are verified against the server-fetched record. The model uses strict structured output, and the application validates citation IDs, unchanged source quotes, numerical quantities, and personal-advice claims. Failures show actionable errors for missing configuration, invalid keys, quota limits, timeout or unverified citations. Existing source excerpts may be displayed as an explicitly labeled fallback, never as a generated answer.

AI paraphrases are explicitly labeled and original excerpts remain visible. Citation checks do not prove that every paraphrase preserves meaning; readers should verify against the displayed original and study team. The demo does not establish eligibility, recommend treatment, promise safety, or translate unsupported languages. English is the supported language. The AI can discuss unclear criteria using the public record; this is not official protocol interpretation.

## Verification

From the root: `node --test tests/trialExplainer.test.js` and `npm.cmd run build`.
From `backend`: `python -m unittest discover -s tests`.

Tests cover unsupported questions, missing fields, missing visits/risks, citation provenance, unsupported languages, fabricated AI quantities, altered quotes, personal advice, unverified source excerpts, and API failure fallback. Unit tests mock model responses. They also check arbitrary question forwarding, full protocol indexing, and rejection of fabricated field citations and quantities. Live model testing requires a configured key.

Structured output implementation reference: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
