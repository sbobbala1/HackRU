import {test, expect} from '@playwright/test';

test('review selection toggles without bypassing final match safeguards', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('vitra-active-recruitment-context-v1', JSON.stringify({study:{nctId:'NCT05564039'}}));
    localStorage.setItem('vitra-ai-review-queue-v1', JSON.stringify({
      'NCT05564039:SYN-001':{profileId:'SYN-001'},
      'NCT05564039:SYN-007':{profileId:'SYN-007'},
    }));
  });
  await page.route('https://clinicaltrials.gov/**', route => route.abort());
  await page.route('**/api/eligibility/rank', route => route.fulfill({json:[
    {profile_id:'SYN-001',study_id:'NCT05564039',rank:1,outcome:'Potential Match',counts:{MET:1,'NOT MET':0,UNKNOWN:1},criteria:[],warnings:[],prioritization_reasons:[],missing_information:[]},
    {profile_id:'SYN-007',study_id:'NCT05564039',rank:2,outcome:'Criteria Conflict',counts:{MET:1,'NOT MET':1,UNKNOWN:0},criteria:[],warnings:[],prioritization_reasons:[],missing_information:[]},
  ]}));
  await page.goto('/researcher/ai-fit-review');
  await page.getByRole('button',{name:'Run AI fit review'}).click();
  const match = page.getByRole('checkbox',{name:/SYN-001/});
  const conflict = page.getByRole('checkbox',{name:/SYN-007/});
  const assign = page.getByRole('button',{name:/Assign .*selected to Final Matches/});
  await expect(assign).toBeDisabled();
  await match.check();
  await expect(match).toBeChecked();
  await expect(assign).toBeEnabled();
  await conflict.check();
  await expect(conflict).toBeChecked();
  await expect(assign).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('need further review');
  await conflict.uncheck();
  await expect(assign).toBeEnabled();
  await match.uncheck();
  await expect(assign).toBeDisabled();
  await match.check();
  await assign.click();
  await expect(match).not.toBeChecked();
  const records = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('vitra-finalist-selections-v1'))));
  expect(records.map(record => record.profileId)).toEqual(['SYN-001']);
});

