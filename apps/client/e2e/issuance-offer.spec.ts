import { test, expect } from '@playwright/test';
import { hasAuthCredentials } from './support/e2e-config';

async function ensureAuthorizationServerConfigured(page: any): Promise<void> {
  await page.getByText('Issuer Settings').click();
  await page.getByRole('button', { description: 'Edit configuration', exact: true }).click();
  await page.getByText('settings_applications Business Logic').click();

  const asInputs = page.getByRole('textbox', { name: 'Authorization Server' });
  const count = await asInputs.count();

  let hasConfiguredAs = false;
  for (let i = 0; i < count; i++) {
    const value = (await asInputs.nth(i).inputValue()).trim();
    if (value.length > 0) {
      hasConfiguredAs = true;
      break;
    }
  }

  if (hasConfiguredAs) {
    return;
  }

  if (count === 0) {
    await page.getByRole('button', { name: 'Add Authorization Server' }).click();
  }

  const currentAsInputs = page.getByRole('textbox', { name: 'Authorization Server' });
  const currentCount = await currentAsInputs.count();
  for (let i = 0; i < currentCount; i++) {
    const value = (await currentAsInputs.nth(i).inputValue()).trim();
    if (!value) {
      await currentAsInputs.nth(i).fill(`https://example-as-${i + 1}.com`);
    }
  }

  const saveConfigButton = page.getByRole('button', { name: 'Save Configuration' });
  if (await saveConfigButton.isEnabled()) {
    await saveConfigButton.click();
  }
}

test('create pre authorized offer', async ({ page }) => {
  test.skip(
    !hasAuthCredentials,
    'Set E2E_TENANT_CLIENT_ID and E2E_TENANT_CLIENT_SECRET for tenant flow tests.',
  );
  await page.goto('/');
  await page.getByText('New Issuance').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('.mat-mdc-select-placeholder').click();
  await page.getByRole('option', { name: 'pid', exact: true }).click();
  await page.locator('.cdk-overlay-backdrop').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Use Pre-configured Default' }).click();
  await page.getByRole('button', { name: 'Generate Offer' }).click();
  await expect(page).toHaveURL(/\/session-management(\/.*)?$/);
});

test('create authorized offer', async ({ page }) => {
  test.skip(
    !hasAuthCredentials,
    'Set E2E_TENANT_CLIENT_ID and E2E_TENANT_CLIENT_SECRET for tenant flow tests.',
  );
  await page.goto('/');

  // Add AS only when none is currently configured.
  await ensureAuthorizationServerConfigured(page);

  //create offer
  await page.getByText('New Issuance').click();
  await page.getByRole('radio', { name: 'Authorization Code (External' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.locator('.mat-mdc-select-placeholder').click();
  await page.getByRole('option', { name: 'pid', exact: true }).click();
  await page.locator('.cdk-overlay-backdrop').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Select an attribute provider', { exact: true }).click();
  await page.getByRole('option', { name: 'claims-provider' }).click();
  await page.getByRole('button', { name: 'Generate Offer' }).click();
  await expect(page).toHaveURL(/\/session-management(\/.*)?$/);
});
