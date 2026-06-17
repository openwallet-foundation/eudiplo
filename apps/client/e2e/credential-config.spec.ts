import { test, expect } from '@playwright/test';
import { hasAuthCredentials } from './support/e2e-config';

test('create credential config', async ({ page }) => {
  test.skip(
    !hasAuthCredentials,
    'Set E2E_TENANT_CLIENT_ID and E2E_TENANT_CLIENT_SECRET for tenant flow tests.',
  );
  await page.goto('/');

  await page.getByText('Credential Types').click();
  await page.getByRole('button').filter({ hasText: 'add' }).click();
  await page.getByRole('button', { name: 'Templates' }).click();
  await page.getByRole('menuitem', { name: 'PID (Personal Identity Document) German Personal Identity Document configuration' }).click();
  await page.getByRole('button', { name: 'Create Configuration' }).click();
  await expect(page).toHaveURL(/\/credential-config(\/.*)?$/);
});
