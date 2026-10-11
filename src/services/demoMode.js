export const demoMode = import.meta.env?.VITE_DEMO_MODE === 'true';

export function criteriaText(trial) {
  const additions = [];
  for (const [value, bound] of [[trial.minAge, 'or older'], [trial.maxAge, 'or younger']]) {
    const match = /^(\d+) Years?$/i.exec(value || '');
    if (match) additions.push(`Age ${match[1]} years ${bound}.`);
  }
  return (trial.eligibility === 'Not provided in the source' ? '' : trial.eligibility || '') +
    (additions.length ? '\nInclusion Criteria:\n' + additions.join('\n') : '');
}
