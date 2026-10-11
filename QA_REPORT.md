# Vitra judging audit

Audit date: 2026-10-10. Scope: the active root React/Vite application, Python API, rules engine, FHIR importer, clinical-trial client, explainer, recruitment views, routes, local persistence, and judging workflow. `frontend/` is an unused starter; the root `index.html` loads `src/main.jsx`.

## Verified workflow

- Live ClinicalTrials.gov search retrieved NCT02930031. Its original eligibility text was parsed and compared with an imported fictional FHIR profile. All nine unsupported criteria remained UNKNOWN; no match facts were invented.
- `/demo` searches three dated snapshots of real public trials, shows the original eligibility criteria and age metadata, parses them, imports three fictional FHIR profiles, and computes criterion results using the existing Python engine.
- Match details include MET, NOT MET, UNKNOWN, original criteria, clinical evidence, provenance, and a screening disclaimer.
- Recruitment Bottleneck Intelligence in `/demo` aggregates those same computed results with the cohort denominator. Missing data remains separate from conflicts.
- The selected study explanation uses cited original excerpts without any external service in demo mode. The live explainer retains AI simplification with server-owned citations and the source-excerpt fallback.
- A candidate's local review workflow status can be updated and survives reload. It does not contact anyone or determine eligibility.
- Chrome exercised the complete workflow with browser requests to ClinicalTrials.gov and LLM domains blocked; backend integration tests also forbid external API/LLM calls in the deterministic path.
- Primary public and patient/researcher routes render without runtime exceptions in explicit demo mode. Sidebar consistency, a 390 px mobile viewport, keyboard activation, official-study URL refresh, and malformed local storage have regression coverage.

## Defects fixed

- Parser route omitted the required sidebar prop; recruitment loading/error screens omitted navigation.
- Ranking could invoke the LLM once per candidate and exceed the browser timeout. Parsing and ranking now default to deterministic computation; optional AI hints require `use_ai: true` and never determine criterion states.
- Mixed age/diagnosis/medication predicates, exceptions, mixed negation, and manual-review rules could be reduced to a recognized fragment. These stay UNKNOWN.
- Future medication/lab dates, empty/partial diagnosis strings, missing threshold units, invalid ages, and nonfinite lab numbers could incorrectly become usable evidence.
- FHIR medications were extracted but not connected to the matching engine. Current status and source provenance now reach the engine; missing duration/history still stays UNKNOWN. Refuted/unconfirmed diagnoses are not used as active evidence.
- Supported OR diagnosis logic was overwritten as UNKNOWN after matching. The import path now retains the engine's result.
- Age metadata in months could be appended as years. Only explicit year metadata is converted into age rules.
- A fictional bottleneck OR rule omitted its knee-pain alternative and treated missing evidence as a conflict. Three-state OR logic now preserves that uncertainty.
- Official trial details depended on browser storage and could substitute a fictional study on reload. NCT URLs now reload and verify the selected official record.
- Cached discovery/detail content could appear labeled live. Snapshots now retain their retrieval timestamp and display cache labels. Unknown NCT IDs never substitute another cached study.
- Malformed local JSON could crash patient pages. Reads validate the expected shape and recover safely.
- Multiple local servers and an old backend could obscure startup failures. The combined launcher checks the API workflow version and reports an incompatible running backend explicitly.
- Several legacy portfolio counts are fixture illustrations; their wording now distinguishes them from computed recruitment results. The shared sidebar exposes the computed recruitment workflow directly.

## Actual validation results

| Check | Result |
| --- | --- |
| Python unit and FastAPI integration tests | 68 passed |
| JavaScript service/unit tests | 20 passed |
| Chrome end-to-end tests | 7 passed |
| Vite production build | Passed; bundle-size warning remains |
| Live public API search and matching smoke test | Passed |
| Tracked-file credential scan | No matching private-key patterns; `backend/.env` is not tracked |
| Dependency install | `npm ci` passed after stopping repository launchers holding native files open |
| Dependency audit | Four high-severity advisories remain in the Firebase → Firestore → gRPC chain |

The credential scan is a bounded pattern check, not a proof that every possible secret is absent. No secret values were printed. Live API and Gemini access were verified in this chat; automated demo tests intentionally require neither provider.

## Remaining limitations

- Complex clinical criteria need manual interpretation. UNKNOWN results and unsupported source wording are expected; this demo cannot establish medical eligibility.
- Offline records may have changed since their displayed retrieval time. Only three real records are bundled. The local Python backend and installed dependencies are required even in offline mode.
- The deterministic explanation fallback displays original wording, which may remain technical. It honestly reports absent results, risks, compensation, or schedules rather than supplying invented details. English only.
- Real Firebase account creation/sign-in, deployed Firestore rules, production hosting, and outbound invitations were not end-to-end validated. Demo UI sign-in bypass is explicit and does not disable privileged API authorization.
- npm 8.4.1 in this environment did not apply the declared gRPC override; audit still reports the four advisories. The affected Node Firestore client is not imported by the application, which uses Firebase app/auth, but that does not remove the dependency finding. Do not claim a clean security audit.
- Python 3.10 emits Google dependency support warnings. Use Python 3.11+ for the demo when available. The build reports a large main chunk; no performance certification or full WCAG audit was performed.
- Legacy fictional portfolio and analytics screens contain labeled illustration fixtures. Use Recruitment workflow or `/demo` for computed matching and aggregation.

## Run the judging demo

Use Node 24.12+ (tested with 24.16.0) and Python 3.11+ where available. Stop all old Vitra website/backend terminals with Ctrl+C before reinstalling or restarting. From the repository root in PowerShell:

```powershell
npm.cmd ci
python -m pip install -r backend/requirements.txt
npm.cmd run demo
```

Open `/demo` at the Local address printed by Vite and keep the terminal open. Search a bundled NCT ID, select it, parse/evaluate, then follow matching, bottlenecks, explanation, and workflow tabs. For a visible known conflict, choose NCT04791371 and the second fictional patient. Use Patients data for the separate explicitly fictional-rule example, including a fully supported preliminary potential match.

For live services and normal Firebase authentication, stop the demo and run `npm.cmd run dev`. Configure Firebase web settings in `.env.local` and Gemini/OpenAI privately in `backend/.env`. Never put provider keys in a `VITE_` variable.

## Repeat tests

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
cd backend
python -m unittest discover -s tests
```

Browser tests use installed Chrome and isolated ports 5188/8018. If Chrome is unavailable, install Chromium with `npx.cmd playwright install chromium` and remove `channel: 'chrome'` from the Playwright configuration. The tests use synthetic data and do not send recruitment messages.
