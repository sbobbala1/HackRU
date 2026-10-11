# Synthetic patient demo

All bundled profiles are hand-authored fictional FHIR R4 examples, not Synthea output or a representative clinical population. No real names, contacts, or medical record numbers are shown. Matching is preliminary and official study screening is required.

Run the frontend from the repository root (`npm.cmd run dev`) and the API from `backend` (`python -m uvicorn app.main:app --reload`). Open **Patients data** in the doctor/researcher sidebar. Three demo profiles cover supported potential matching, an exclusion conflict, and insufficient evidence. Add the fictional cancer exclusion to demonstrate the documented conflict. Imports and matching need the API; a visibly dated read-only snapshot and downloadable fictional examples remain available without it.

## Generate additional Synthea data

Use the official Synthea repository: https://github.com/synthetichealth/synthea and its README for the current Java prerequisites. Clone it outside this project. In its Windows checkout, run:

```powershell
.\gradlew.bat build -x test
.\run_synthea.bat -p 5 --exporter.fhir.export=true --exporter.fhir_stu3.export=false --exporter.fhir_dstu2.export=false Massachusetts
```

Import one generated patient JSON Bundle from `output/fhir` using the Patients data file input. Confirm synthetic-only data first. The downloader provides an array of demo Bundles; extract one array element to a separate JSON file to import it. Files are not persisted, logged, sent to researchers, or stored in Firestore by these endpoints. The synthetic attestation is a user assertion, not proof that an uploaded record is fictional. Never upload actual patient data. Production access controls, transport security, request size enforcement, and retention controls must be added before any non-demo deployment.

## Normalization and limitations

One Patient per Bundle is required. Patient references resolve through Patient/id or Bundle fullUrl. Conditions, MedicationRequest/Statement, referenced Medication resources, Procedures, Observation quantities, and observation components are extracted. Unsupported resources remain unextracted. Every normalized evidence item carries Bundle SHA-256, entry index and source paths. Raw personal identifiers are omitted. Profile IDs derive from the source hash, not names or medical record numbers.

Age is calculated using UTC date. Missing, invalid, or future birth dates remain unknown. Observations require finite quantities, final/amended/corrected status, valid non-future dates, compatible units, and age at most 90 days. Shorter criterion time windows further restrict evidence. Conflicting quantities for the same code/date are withheld. Original quantity and unit are preserved. Only glucose LOINC 2345-7/2339-0 has an explicit mmol/L to mg/dL conversion (factor 18.0182); other analytes are not silently converted. Unknown units are retained but withheld from matching. Non-quantity observations and unresolved references are not used as evidence. The most recent usable compatible lab is chosen.

Only active documented conditions support diagnosis checks. Missing diagnoses never prove absence. Documented diagnosis exclusions produce conflicts; absent exclusion evidence remains UNKNOWN. Medication/procedure histories are inspectable but unsupported eligibility rules remain UNKNOWN, including uncertain temporal or compound logic. No clinical completeness is inferred.

Run validation from `backend`:

```powershell
python -m unittest discover -s tests
```
