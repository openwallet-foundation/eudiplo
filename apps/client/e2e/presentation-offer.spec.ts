import { expect, test } from '@playwright/test';
import { hasAuthCredentials } from './support/e2e-config';

test('presentation offer page is reachable when authenticated', async ({ page }) => {
  test.skip(
    !hasAuthCredentials,
    'Set E2E_TENANT_CLIENT_ID and E2E_TENANT_CLIENT_SECRET for tenant flow tests.',
  );

  await page.goto('/');

  await page.getByText('New Verification').click();
  await page.getByRole('button', { name: 'Generate Request' }).click();
  await expect(page).toHaveURL(/\/session-management(\/.*)?$/);
});

test('presentation offer with dc api', async ({ page }) => {
  test.skip(
    !hasAuthCredentials,
    'Set E2E_TENANT_CLIENT_ID and E2E_TENANT_CLIENT_SECRET for tenant flow tests.',
  );

  await page.goto('/');

  await page.getByText('New Verification').click();

  await page.getByRole('switch', { name: 'Use DC-API instead of QR-Code' }).click();
  await page.getByRole('button', { name: 'Generate Request' }).click();
  await expect(page).toHaveURL(/\/session-management(\/.*)?$/);
  await expect(page.getByRole("button", {name: 'DC API'})).toBeVisible();
});
