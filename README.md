# Vitra

## Website areas

Vitra has two main user-facing areas:

- **Public website (frontend):** the homepage and public navigation pages, including How it works, Clinical trial guide, Locations, Research team, and About us. Visitors can explore these pages without signing in. The Locations page lets visitors switch between nearby healthcare locations sourced from OpenStreetMap and recruiting study records sourced from ClinicalTrials.gov.
- **Signed-in workspaces:** users sign in or create an account before opening the patient or researcher workspace. Patient pages contain the user's own profile and saved-study experience. Researcher pages contain study management, synthetic patient review, eligibility parsing, and recruitment tools. Workspace access and available actions depend on the user's role.

The signed-in pages are still part of the frontend. The backend is the separate service layer that supports trusted operations and data access, including the FastAPI API and Firebase Authentication/Firestore described below.

## Synthetic patient workspace

The doctor/researcher **Patients data** page imports synthetic FHIR R4 patient Bundles, displays source provenance and validated clinical evidence, and compares normalized profiles with parsed eligibility rules. A fictional demo dataset and offline read-only snapshot are included. See [generation, import, and validation instructions](backend/SYNTHETIC_DATA.md). All matching remains preliminary; official screening is required.

Full-stack hackathon prototype: React/Vite frontend, Firebase Authentication and Firestore persistence, FastAPI for trusted match and invitation operations, and Firebase Hosting configuration.

## Run locally

Frontend:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Backend (Python 3.11+):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Populate `.env.local` with a Firebase web app configuration. Set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase Admin service account file for the API. Neither credentials nor Firebase project configuration is committed.

## Firebase deployment

```bash
npm run build
firebase login
firebase use <your-project-id>
firebase deploy --only hosting,firestore:rules
```

Set Firebase Auth custom claims (`role: "researcher"`) using a trusted admin process before granting researcher API access. The app deliberately retains its locally labeled demo mode until Firebase configuration is supplied.

The researcher **Eligibility parser** page compares 12 fictional profiles with three live ClinicalTrials.gov records (`NCT05564039`, `NCT05025787`, and `NCT04791371`). Results expose each criterion as `MET`, `NOT MET`, or `UNKNOWN`; unknown data stays visible and is never counted as met. The category and ordering are review-prioritization heuristics only, not eligibility or enrollment decisions. Set `OPENAI_API_KEY` in `backend/.env` to enable optional structured parsing suggestions and plain-language explanations. The deterministic rules engine remains authoritative for criterion states; without a key, the parser and per-criterion explanations work without LLM calls.

Backend tests: `cd backend && python -m unittest discover -s tests -v`.
