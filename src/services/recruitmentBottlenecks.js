/** Deterministic criterion-level evaluation for the synthetic researcher demo. */
export const demoCohort = [
  { id: 'DEMO-001', age: 52, condition: 'Type 2 Diabetes', smartphone: true, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: false, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-002', age: 69, condition: 'Type 2 Diabetes', smartphone: null, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: null, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-003', age: 41, condition: 'Type 2 Diabetes', smartphone: true, pregnant: null, activeIntervention: null, tobacco: false, recentHospitalization: false, questionnaire: null, diagnosisKnown: true },
  { id: 'DEMO-004', age: 34, condition: 'Asthma', smartphone: true, pregnant: false, activeIntervention: false, tobacco: true, recentHospitalization: true, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-005', age: 58, condition: 'Asthma', smartphone: false, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: false, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-006', age: 73, condition: 'Type 2 Diabetes', smartphone: true, pregnant: false, activeIntervention: true, tobacco: false, recentHospitalization: false, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-007', age: 46, condition: 'Osteoarthritis', smartphone: true, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: false, questionnaire: false, diagnosisKnown: true },
  { id: 'DEMO-008', age: 39, condition: 'Asthma', smartphone: null, pregnant: false, activeIntervention: false, tobacco: null, recentHospitalization: false, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-009', age: 66, condition: 'Osteoarthritis', smartphone: true, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: false, questionnaire: true, diagnosisKnown: null },
  { id: 'DEMO-010', age: 29, condition: 'Type 2 Diabetes', smartphone: true, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: false, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-011', age: 61, condition: 'Asthma', smartphone: true, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: null, questionnaire: true, diagnosisKnown: true },
  { id: 'DEMO-012', age: 54, condition: 'Osteoarthritis', smartphone: true, pregnant: false, activeIntervention: false, tobacco: false, recentHospitalization: false, questionnaire: true, diagnosisKnown: true },
];

// These are structured demo representations of each study's displayed criteria.
// The demo intentionally includes missing values to show UNKNOWN separately.
export const demoStudyCriteria = {
  'pm-101': [
    { id: 'age-range', text: 'Age 18–75 years', field: 'age', op: 'range', min: 18, max: 75, category: 'inclusion' },
    { id: 'diagnosis', text: 'Diagnosis of type 2 diabetes', field: 'condition', op: 'equals', value: 'Type 2 Diabetes', category: 'inclusion' },
    { id: 'smartphone', text: 'Able to use a smartphone', field: 'smartphone', op: 'true', category: 'inclusion' },
    { id: 'pregnancy', text: 'Pregnant or planning pregnancy', field: 'pregnant', op: 'false', category: 'exclusion' },
    { id: 'other-study', text: 'Currently enrolled in another intervention study', field: 'activeIntervention', op: 'false', category: 'exclusion' },
  ],
  'pm-102': [
    { id: 'age-range', text: 'Age 18–65 years', field: 'age', op: 'range', min: 18, max: 65, category: 'inclusion' },
    { id: 'diagnosis', text: 'Clinical diagnosis of asthma', field: 'condition', op: 'equals', value: 'Asthma', category: 'inclusion' },
    { id: 'tobacco', text: 'Current tobacco use', field: 'tobacco', op: 'false', category: 'exclusion' },
    { id: 'hospitalization', text: 'Recent hospitalization for asthma', field: 'recentHospitalization', op: 'false', category: 'exclusion' },
  ],
  'pm-103': [
    { id: 'age-min', text: 'Age 40 years or older', field: 'age', op: 'min', min: 40, category: 'inclusion' },
    { id: 'diagnosis-or-pain', text: 'Osteoarthritis diagnosis or chronic knee pain', field: 'condition', op: 'equals', value: 'Osteoarthritis', category: 'inclusion' },
    { id: 'questionnaire', text: 'Able to complete online questionnaires', field: 'questionnaire', op: 'true', category: 'exclusion' },
  ],
};

export function evaluateCriterion(criterion, profile) {
  const value = profile[criterion.field];
  if (value === null || value === undefined || value === '') return 'UNKNOWN';
  if (criterion.op === 'range') return value >= criterion.min && value <= criterion.max ? 'MET' : 'NOT_MET';
  if (criterion.op === 'min') return value >= criterion.min ? 'MET' : 'NOT_MET';
  if (criterion.op === 'equals') return value === criterion.value ? 'MET' : 'NOT_MET';
  if (criterion.op === 'true') return value === true ? 'MET' : 'NOT_MET';
  if (criterion.op === 'false') return value === false ? 'MET' : 'NOT_MET';
  return 'UNKNOWN';
}

export function evaluateTrial(criteria, cohort) {
  return criteria.flatMap((criterion) => cohort.map((profile) => ({
    criterionId: criterion.id,
    criterion: criterion.text,
    category: criterion.category,
    profileId: profile.id,
    status: evaluateCriterion(criterion, profile),
  })));
}

export function aggregateBottlenecks(criteria, criterionRows, cohortSize) {
  const byId = new Map(criteria.map((criterion) => [criterion.id, { ...criterion, MET: 0, NOT_MET: 0, UNKNOWN: 0, knownConflictIds: [], unknownIds: [] }]));
  const seen = new Set();
  for (const row of criterionRows) {
    const item = byId.get(row.criterionId);
    if (!item || !['MET', 'NOT_MET', 'UNKNOWN'].includes(row.status)) continue;
    const key = `${row.criterionId}:${row.profileId}`;
    if (seen.has(key)) continue; // Guard against duplicate matcher rows for the same criterion/profile.
    seen.add(key);
    item[row.status] += 1;
    if (row.status === 'NOT_MET') item.knownConflictIds.push(row.profileId);
    if (row.status === 'UNKNOWN') item.unknownIds.push(row.profileId);
  }
  return [...byId.values()].map((item) => ({
    ...item,
    denominator: cohortSize,
    conflictRate: cohortSize ? item.NOT_MET / cohortSize : 0,
    unknownRate: cohortSize ? item.UNKNOWN / cohortSize : 0,
    burden: item.NOT_MET + item.UNKNOWN,
    affectedIds: [...new Set([...item.knownConflictIds, ...item.unknownIds])],
  })).sort((a, b) => b.burden - a.burden || b.NOT_MET - a.NOT_MET || b.UNKNOWN - a.UNKNOWN || a.id.localeCompare(b.id));
}
