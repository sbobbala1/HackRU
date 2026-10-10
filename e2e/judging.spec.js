import {test, expect} from '@playwright/test';

async function loadDemo(page) {
  await page.goto('/demo');
  await page.getByLabel('1. Search cached real trial records').fill('NCT05564039');
  await page.getByRole('button', {name:/NCT05564039/}).click();
  await expect(page.getByText('2. Original eligibility criteria', {exact:true})).toBeVisible();
  await page.getByRole('button', {name:'3. Parse criteria and evaluate synthetic patients'}).click();
  await expect(page.getByLabel('4. Fictional patient')).toBeVisible();
}

test('complete judging workflow remains usable with external services blocked',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(/https:\/\/(clinicaltrials\.gov|generativelanguage\.googleapis\.com|api\.openai\.com)/,route=>route.abort());
  await loadDemo(page);
  await expect(page.getByText(/MET \d+ · NOT MET \d+ · UNKNOWN \d+/)).toBeVisible();
  await page.getByRole('button',{name:'7. Recruitment Bottleneck Intelligence'}).click();
  await expect(page.getByRole('heading',{name:'Recruitment Bottleneck Intelligence',exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'UNKNOWN',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'8. Trial explanation'}).click();
  await page.getByRole('button',{name:'Explain selected study'}).click();
  await expect(page.getByText('Relevant excerpts from the selected study are shown below.')).toBeVisible();
  await page.getByRole('button',{name:'9. Workflow status'}).click();
  await page.getByLabel('Candidate review status').selectOption('Screening in Progress');
  await expect(page.getByRole('listitem').filter({hasText:'Screening in Progress'})).toBeVisible();
  await page.reload();await loadDemo(page);
  await page.getByRole('button',{name:'9. Workflow status'}).click();
  await expect(page.getByLabel('Candidate review status')).toHaveValue('Screening in Progress');
  expect(errors).toEqual([]);
});

test('researcher sidebar and functional routes remain consistent',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for (const route of ['/researcher/parser','/researcher/patients','/researcher/explainer','/researcher/recruitment']) {
    await page.goto(route);
    await expect(page.getByRole('navigation',{name:'researcher workspace navigation'})).toBeVisible();
    for (const label of ['Patients data','Trial explainer','Eligibility parser','Recruitment workflow']) {
      await expect(page.getByRole('navigation').getByRole('button',{name:label,exact:true})).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test('trial explainer uses cached study and deterministic source answers in demo mode',async({page})=>{
  await page.goto('/researcher/explainer');
  await page.getByLabel('Find a real clinical trial').fill('NCT05564039');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByRole('heading',{name:'About this study'})).toBeVisible();
  await expect(page.getByText('Cached ClinicalTrials.gov snapshot (demo fallback)',{exact:false})).toBeVisible();
  await page.getByLabel('What would you like to know?').fill('What are the study results?');
  await page.getByRole('button',{name:'Ask question',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Answer',exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('mobile judging flow fits viewport and keyboard controls have accessible names',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await loadDemo(page);
  await expect(page.getByLabel('4. Fictional patient')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth+2);
  expect(overflow).toBe(false);
  await page.getByRole('button',{name:'9. Workflow status'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Candidate review status')).toBeVisible();
});

test('public and remaining workspace routes render without runtime exceptions',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for (const route of ['/', '/about', '/how-it-works', '/research-team', '/clinical-trial-guide', '/locations', '/login', '/signup',
    '/researcher/dashboard', '/researcher/trials', '/researcher/trials/new', '/researcher/analytics', '/researcher/settings',
    '/patient/dashboard', '/patient/trials', '/patient/profile', '/patient/saved', '/patient/settings']) {
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('official trial detail URL survives refresh without substituting a fictional study',async({page})=>{
  await page.goto('/trials/NCT05564039');
  await expect(page.getByRole('heading',{name:/A Study of Tirzepatide/})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Original eligibility criteria',{exact:true})).toBeVisible();
  await expect(page.getByText('BRIGHT Path: Type 2 Diabetes Lifestyle Study',{exact:true})).toHaveCount(0);
});

test('malformed local demo storage does not crash workspace pages',async({page})=>{
  await page.goto('/demo');
  await page.evaluate(()=>{localStorage.setItem('pm-saved','broken');localStorage.setItem('pm-profile','broken');});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  for(const route of ['/patient/dashboard','/patient/profile','/patient/settings','/patient/saved']) {
    await page.goto(route);await expect(page.locator('h1').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
