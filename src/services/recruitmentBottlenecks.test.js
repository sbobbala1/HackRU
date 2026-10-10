import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateBottlenecks, evaluateCriterion, evaluateTrial } from './recruitmentBottlenecks.js';

test('uses the full cohort as denominator and aggregates each status', () => {
  const criteria = [{ id: 'age', text: 'Age 18+', field: 'age', op: 'min', min: 18, category: 'inclusion' }];
  const cohort = [{ id: 'a', age: 20 }, { id: 'b', age: 16 }, { id: 'c', age: null }];
  const ranked = aggregateBottlenecks(criteria, evaluateTrial(criteria, cohort), cohort.length);
  assert.equal(ranked[0].denominator, 3);
  assert.equal(ranked[0].MET, 1);
  assert.equal(ranked[0].NOT_MET, 1);
  assert.equal(ranked[0].UNKNOWN, 1);
});

test('does not double count duplicate matcher rows for one criterion/profile', () => {
  const criteria = [{ id: 'age', text: 'Age', field: 'age', op: 'min', min: 18, category: 'inclusion' }];
  const rows = [
    { criterionId: 'age', profileId: 'a', status: 'NOT_MET' },
    { criterionId: 'age', profileId: 'a', status: 'NOT_MET' },
  ];
  const result = aggregateBottlenecks(criteria, rows, 1)[0];
  assert.equal(result.NOT_MET, 1);
  assert.deepEqual(result.knownConflictIds, ['a']);
});

test('keeps missing values UNKNOWN and separate from exclusion conflicts', () => {
  const criterion = { id: 'tobacco', text: 'No current tobacco use', field: 'tobacco', op: 'false', category: 'exclusion' };
  assert.equal(evaluateCriterion(criterion, { tobacco: null }), 'UNKNOWN');
  assert.equal(evaluateCriterion(criterion, { tobacco: true }), 'NOT_MET');
  assert.equal(evaluateCriterion(criterion, { tobacco: false }), 'MET');
});

test('aggregates distinct criteria with the same text independently and ranks affected counts', () => {
  const criteria = [
    { id: 'one', text: 'Same wording', field: 'x', op: 'true', category: 'inclusion' },
    { id: 'two', text: 'Same wording', field: 'y', op: 'true', category: 'inclusion' },
  ];
  const result = aggregateBottlenecks(criteria, [
    { criterionId: 'one', profileId: 'a', status: 'UNKNOWN' },
    { criterionId: 'two', profileId: 'b', status: 'NOT_MET' },
    { criterionId: 'two', profileId: 'c', status: 'NOT_MET' },
  ], 3);
  assert.equal(result[0].id, 'two');
  assert.equal(result[0].burden, 2);
  assert.equal(result[1].id, 'one');
  assert.equal(result[1].unknownRate, 1 / 3);
});
