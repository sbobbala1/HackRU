# Vitra

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
