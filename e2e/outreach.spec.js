import {test, expect} from '@playwright/test';

async function seed(page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('outreach-test-seeded')) return;
    localStorage.setItem('outreach-test-seeded','yes');
    localStorage.setItem('vitra-active-recruitment-context-v1',JSON.stringify({study:{nctId:'NCT05564039'}}));
    localStorage.setItem('vitra-finalist-selections-v1',JSON.stringify({one:{researcherId:'demo-researcher',profileId:'SYN-001',trialId:'NCT05564039',trialTitle:'Synthetic test context',publicSite:'Demo site',availability:'Available',deterministicOutcome:'Potential Match',outreachDraftStatus:'Draft created',outreachDraftType:'screening-follow-up',selectedAt:'2026-10-10T12:00:00Z'}}));
  });
  await page.route('https://clinicaltrials.gov/**',route=>route.abort());
}

test('outreach opens and completion archives and resets the cycle',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await seed(page);
  await page.goto('/researcher/outreach');
  await expect(page.getByRole('heading',{name:'Outreach Center',exact:true})).toBeVisible();
  await page.locator('.outreach-composer select').first().selectOption('SMS / text');
  await page.getByRole('button',{name:/Completed cycles/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Close archive'}).click();
  await page.getByRole('button',{name:/^Inbox/}).click();
  await page.getByRole('button',{name:'Complete outreach cycle',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Complete and reset cycle'}).click();
  await expect(page).toHaveURL(/researcher\/screening/);
  const state=await page.evaluate(()=>({finalists:JSON.parse(localStorage.getItem('vitra-finalist-selections-v1')),archives:JSON.parse(localStorage.getItem('vitra-completed-recruitment-cycles-v1'))}));
  expect(Object.keys(state.finalists)).toHaveLength(0);
  expect(state.archives[0].participants[0].syntheticParticipantId).toBe('SYN-001');
  expect(errors).toEqual([]);
});

test('stale saved recipients do not crash outreach or its inbox',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await seed(page);
  await page.goto('/researcher/outreach');
  await page.evaluate(()=>{
    const records=JSON.parse(localStorage.getItem('vitra-finalist-selections-v1'));
    records.one.profileId='SYN-REMOVED';
    records.invalid=null;
    localStorage.setItem('vitra-finalist-selections-v1',JSON.stringify(records));
  });
  await page.reload();
  await page.getByRole('button',{name:/^Inbox/}).click();
  await expect(page.getByRole('heading',{name:'Inbox',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('researcher account remains reachable in a short viewport',async({page})=>{
  await page.setViewportSize({width:1100,height:540});
  await page.goto('/researcher/outreach');
  await page.locator('.side-account').click();
  await expect(page.locator('.account-menu')).toBeInViewport();
  await page.locator('.account-menu').getByRole('button',{name:'Profile & settings'}).click();
  await expect(page).toHaveURL(/researcher\/settings/);
});

test('bulk email updates all recipients and folder counts persist',async({page})=>{
  await seed(page);
  await page.goto('/researcher/outreach');
  await page.evaluate(()=>{
    const records=JSON.parse(localStorage.getItem('vitra-finalist-selections-v1'));
    records.two={...records.one,profileId:'SYN-007'};
    localStorage.setItem('vitra-finalist-selections-v1',JSON.stringify(records));
  });
  await page.reload();
  await expect(page.getByRole('button',{name:/^Inbox/})).toHaveText('Inbox0');
  await expect(page.getByRole('button',{name:/^Drafts/})).toHaveText('Drafts2');
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('button',{name:'Send email',exact:true}).click();
  await expect(page.locator('.outreach-folders').getByRole('button',{name:/^Sent/})).toHaveText('Sent2');
  await expect(page.getByRole('button',{name:/^Drafts/})).toHaveText('Drafts0');
  await page.locator('.outreach-folders').getByRole('button',{name:/^Sent/}).click();
  await expect(page.locator('.outreach-recipient')).toHaveCount(2);
  await page.getByLabel('Demo reply').fill('A saved fictional reply for the demo.');
  await page.getByRole('button',{name:'Record demo reply'}).click();
  await page.getByRole('button',{name:/^Inbox/}).click();
  await expect(page.locator('.inbox-message')).toContainText('A saved fictional reply');
  await page.reload();
  await expect(page.getByRole('button',{name:/^Inbox/})).toHaveText('Inbox1');
  await expect(page.locator('.outreach-folders').getByRole('button',{name:/^Sent/})).toHaveText('Sent1');
  await expect(page.locator('.outreach-folders').getByRole('button',{name:/^Responded/})).toHaveText('Responded1');
});


