import type { Routes } from '@angular/router';

export const schemaRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./schema-list/schema-list.component').then((m) => m.SchemaListComponent),
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./schema-create/schema-create.component').then((m) => m.SchemaCreateComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./schema-show/schema-show.component').then((m) => m.SchemaShowComponent),
  },
];
