import type { Routes } from '@angular/router';

export const keyManagementRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./key-management-list/key-management-list.component').then(
        (m) => m.KeyManagementListComponent
      ),
  },
  {
    path: 'providers',
    loadComponent: () =>
      import('./key-management-providers/key-management-providers.component').then(
        (m) => m.KeyManagementProvidersComponent
      ),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./key-create-wizard/key-create-wizard.component').then(
        (m) => m.KeyCreateWizardComponent
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./key-management-show/key-management-show.component').then(
        (m) => m.KeyManagementShowComponent
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./key-management-create/key-management-create.component').then(
        (m) => m.KeyManagementCreateComponent
      ),
  },
];
