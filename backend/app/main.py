"""FastAPI service for trusted, consent-aware recruitment operations.

The browser never reads match results directly. Firebase Authentication tokens are
verified here and Firestore Admin access is used only after role and consent checks.
"""
from datetime import datetime, timezone
from typing import Literal

import firebase_admin
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import auth, credentials, firestore
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from .eligibility_parser import ParsedEligibility, parse_deterministic
from .eligibility_matcher import ParsedMatch, SyntheticProfile, match_parsed_eligibility

app = FastAPI(title="Vitra API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # replace/add Hosting domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
security = HTTPBearer()


def db():
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.ApplicationDefault())
    return firestore.client()


def current_user(token: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        return auth.verify_id_token(token.credentials)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase ID token") from exc


def require_researcher(user: dict = Depends(current_user)) -> dict:
    # Custom claims are authoritative; the role field is not trusted from the client.
    if user.get("role") != "researcher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Researcher role required")
    return user


class TrialInput(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    summary: str = Field(min_length=10, max_length=5000)
    condition: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=240)
    recruitment_status: str = "Recruiting"
    inclusion_criteria: list[str] = []
    exclusion_criteria: list[str] = []
    minimum_age: int | None = Field(default=None, ge=0, le=120)
    maximum_age: int | None = Field(default=None, ge=0, le=120)


class InvitationInput(BaseModel):
    participant_id: str
    preview: str = Field(max_length=1000)

class EligibilityParseInput(BaseModel):
    study_id: str = Field(min_length=1, max_length=64)
    original_eligibility_text: str = Field(max_length=50000)

class ParsedMatchInput(BaseModel):
    parsed: ParsedEligibility
    profile: SyntheticProfile


@app.get("/health")
def health():
    return {"status": "ok", "service": "Vitra API"}

@app.post("/eligibility/parse", response_model=ParsedEligibility)
def parse_eligibility(payload: EligibilityParseInput):
    """Deterministic fallback parser.

    An optional LLM integration must use strict JSON Schema structured output,
    validate it against ParsedEligibility, and retain original_text for every rule.
    The fallback is intentionally conservative and flags ambiguous wording.
    """
    return parse_deterministic(payload.study_id, payload.original_eligibility_text)

@app.post('/eligibility/match', response_model=ParsedMatch)
def match_eligibility(payload: ParsedMatchInput):
    return match_parsed_eligibility(payload.parsed, payload.profile)


@app.post("/trials", status_code=status.HTTP_201_CREATED)
def create_trial(trial: TrialInput, user: dict = Depends(require_researcher)):
    if trial.minimum_age and trial.maximum_age and trial.minimum_age > trial.maximum_age:
        raise HTTPException(status_code=422, detail="Minimum age cannot exceed maximum age")
    ref = db().collection("trials").document()
    record = trial.model_dump() | {
        "created_by": user["uid"],
        "source": "manual",
        "published": False,
        "created_at": datetime.now(timezone.utc),
    }
    ref.set(record)
    return {"id": ref.id, **trial.model_dump(), "published": False}


def preliminary_match(profile: dict, trial: dict) -> dict:
    """Deterministic, explainable checks. Unknown is never treated as satisfied."""
    satisfied, unsatisfied, unknown = [], [], []
    age = profile.get("age")
    if age is None:
        unknown.append("Age was not supplied")
    elif trial.get("minimum_age") is not None and age < trial["minimum_age"]:
        unsatisfied.append("Below stated minimum age")
    elif trial.get("maximum_age") is not None and age > trial["maximum_age"]:
        unsatisfied.append("Above stated maximum age")
    else:
        satisfied.append("Age fits the entered range")
    conditions = {item.lower() for item in profile.get("conditions", [])}
    if not conditions:
        unknown.append("Relevant condition was not supplied")
    elif trial["condition"].lower() in conditions:
        satisfied.append("Condition aligns with the study topic")
    else:
        unsatisfied.append("Study condition is not listed in the profile")
    category: Literal["Potential Match", "Needs More Information", "Potentially Ineligible"]
    category = "Potentially Ineligible" if unsatisfied else "Needs More Information" if unknown else "Potential Match"
    return {"category": category, "satisfied": satisfied, "unsatisfied": unsatisfied, "unknown": unknown,
            "explanation": "Preliminary deterministic comparison only; clinical screening is required."}


@app.get("/trials/{trial_id}/matches")
def trial_matches(trial_id: str, user: dict = Depends(require_researcher)):
    trial = db().collection("trials").document(trial_id).get()
    if not trial.exists:
        raise HTTPException(status_code=404, detail="Trial not found")
    # Query only profiles with explicit recruitment-sharing consent. Return the minimum necessary fields.
    profiles = db().collection("patientProfiles").where("recruitment_consent", "==", True).stream()
    results = []
    for profile in profiles:
        data = profile.to_dict()
        results.append({"participant_id": data.get("demo_identifier", profile.id), **preliminary_match(data, trial.to_dict())})
    return {"trial_id": trial_id, "results": results, "disclaimer": "Results are preliminary and not eligibility decisions."}


@app.post("/trials/{trial_id}/invitations", status_code=status.HTTP_201_CREATED)
def record_invitation(trial_id: str, invitation: InvitationInput, user: dict = Depends(require_researcher)):
    # A production implementation should re-check consent and trial ownership atomically here.
    db().collection("invitations").add({
        "trial_id": trial_id, "participant_id": invitation.participant_id, "preview": invitation.preview,
        "status": "recorded", "created_by": user["uid"], "created_at": datetime.now(timezone.utc),
    })
    return {"status": "recorded", "message": "No outbound message is sent by this API."}
