import '@angular/compiler';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  getTenant: vi.fn(),
  initTenant: vi.fn(),
  updateTenant: vi.fn(),
}));

vi.mock('@eudiplo/sdk-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eudiplo/sdk-core')>()),
  tenantControllerGetTenant: sdkMocks.getTenant,
  tenantControllerInitTenant: sdkMocks.initTenant,
  tenantControllerUpdateTenant: sdkMocks.updateTenant,
}));

import { TenantCreateComponent } from './tenant-create.component';

describe('TenantCreateComponent', () => {
  let component: TenantCreateComponent;
  let routeId: string | null;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    routeId = null;
    router = { navigate: vi.fn().mockResolvedValue(true) };
    sdkMocks.initTenant.mockResolvedValue({ data: {} });
    sdkMocks.updateTenant.mockResolvedValue({ data: {} });

    component = new TenantCreateComponent(
      new FormBuilder(),
      { open: vi.fn() } as never,
      router as never,
      {
        snapshot: { paramMap: { get: vi.fn(() => routeId) } },
      } as never,
      { open: vi.fn(() => ({ afterClosed: () => of(undefined) })) } as never,
      { getBaseUrl: vi.fn(() => 'http://localhost:3000') } as never
    );
  });

  it('omits an empty description from create requests', async () => {
    component.tenantForm.setValue({
      id: ' tenant ',
      name: ' Tenant ',
      description: '   ',
      roles: ['clients:manage'],
    });

    await component.onSubmit();

    expect(sdkMocks.initTenant).toHaveBeenCalledWith({
      body: {
        id: 'tenant',
        name: 'Tenant',
        roles: ['clients:manage'],
      },
    });
  });

  it('trims a non-empty create description', async () => {
    component.tenantForm.setValue({
      id: 'tenant',
      name: 'Tenant',
      description: '  Example tenant  ',
      roles: ['clients:manage'],
    });

    await component.onSubmit();

    expect(sdkMocks.initTenant).toHaveBeenCalledWith({
      body: expect.objectContaining({ description: 'Example tenant' }),
    });
  });

  it('omits an untouched description and create-only fields from updates', async () => {
    routeId = 'tenant';
    component.isEditMode = true;
    component.tenantForm.patchValue({
      id: 'tenant',
      name: ' Renamed ',
      description: 'Existing description',
      roles: ['tenants:manage'],
    });
    component.tenantForm.markAsPristine();

    await component.onSubmit();

    expect(sdkMocks.updateTenant).toHaveBeenCalledWith({
      path: { id: 'tenant' },
      body: { name: 'Renamed' },
    });
  });

  it('sends null when an existing description is intentionally cleared', async () => {
    routeId = 'tenant';
    component.isEditMode = true;
    component.tenantForm.patchValue({
      id: 'tenant',
      name: 'Tenant',
      description: 'Existing description',
    });
    component.tenantForm.markAsPristine();
    component.tenantForm.get('description')!.setValue('   ');
    component.tenantForm.get('description')!.markAsDirty();

    await component.onSubmit();

    expect(sdkMocks.updateTenant).toHaveBeenCalledWith({
      path: { id: 'tenant' },
      body: { name: 'Tenant', description: null },
    });
  });

  it('trims an edited update description', async () => {
    routeId = 'tenant';
    component.isEditMode = true;
    component.tenantForm.patchValue({
      id: 'tenant',
      name: 'Tenant',
      description: 'Existing description',
    });
    component.tenantForm.markAsPristine();
    component.tenantForm.get('description')!.setValue('  Updated description  ');
    component.tenantForm.get('description')!.markAsDirty();

    await component.onSubmit();

    expect(sdkMocks.updateTenant).toHaveBeenCalledWith({
      path: { id: 'tenant' },
      body: { name: 'Tenant', description: 'Updated description' },
    });
  });

  it('leaves the form pristine after loading tenant data', async () => {
    sdkMocks.getTenant.mockResolvedValue({
      data: { id: 'tenant', name: 'Tenant', description: null },
    });

    await (component as unknown as { loadTenant(id: string): Promise<void> }).loadTenant('tenant');

    expect(component.tenantForm.pristine).toBe(true);
    expect(component.tenantForm.get('description')!.value).toBe('');
  });
});
