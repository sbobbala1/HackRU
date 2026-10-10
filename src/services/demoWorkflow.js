export const workflowStages = ['Needs Review', 'Screening in Progress', 'Review Complete'];
export function updateWorkflow(state, studyId, profileId, stage, at = new Date().toISOString()) {
  if (!workflowStages.includes(stage)) throw new Error('Unsupported demo workflow status');
  const key = `${studyId}:${profileId}`;
  const previous = state[key] || {events: []};
  return {...state, [key]: {stage, events: [...(Array.isArray(previous.events) ? previous.events : []), {stage, at}]}};
}

export function matchBottlenecks(matches) {
  const byId = new Map();
  for (const match of matches) for (const criterion of match.criteria) {
    const key = criterion.criterion_id;
    if (!byId.has(key)) byId.set(key, {id: key, text: criterion.original_text, MET: 0, NOT_MET: 0, UNKNOWN: 0});
    const status = criterion.status.replace(' ', '_');
    if (['MET', 'NOT_MET', 'UNKNOWN'].includes(status)) byId.get(key)[status]++;
  }
  return [...byId.values()].map(c => ({...c, denominator: matches.length, burden: c.NOT_MET + c.UNKNOWN}))
    .sort((a,b) => b.burden - a.burden || a.id.localeCompare(b.id));
}
