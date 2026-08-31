import type { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { getRole } from './services/jwt.service';
import { RoleGuard } from './guards/roles.guard';

// Feature route imports
import {
  issuanceConfigRoutes,
  issuanceOfferRoutes,
  credentialConfigRoutes,
  attributeProviderRoutes,
} from './issuance/issuance.routes';
import { webhookEndpointRoutes } from './webhook-endpoint/webhook-endpoint.routes';
import { keyManagementRoutes } from './key-management/key-management.routes';
import {
  presentationConfigRoutes,
  presentationOfferRoutes,
} from './presentation/presentation.routes';
import { sessionManagementRoutes } from './session-management/session-management.routes';
import { statusListRoutes } from './status-list-management/status-list.routes';
import { clientRoutes, tenantRoutes } from './tenants/tenants.routes';
import { trustListRoutes } from './trust-list/trust-list.routes';
import { userRoutes } from './users/users.routes';
import { schemaRoutes } from './schema/schema.routes';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'settings/connection',
    loadComponent: () =>
      import('./settings/connection-settings/connection-settings.component').then(
        (m) => m.ConnectionSettingsComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'settings/config-portability',
    loadComponent: () =>
      import('./config-portability/config-portability.component').then(
        (m) => m.ConfigPortabilityComponent
      ),
    canActivate: [AuthGuard, RoleGuard],
    data: {
      role: [getRole('tenants:manage'), getRole('tenant:admin')],
    },
  },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },

  // Tenant & Client routes
  {
    path: 'clients',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('clients:manage') },
    children: clientRoutes,
  },
  {
    path: 'users',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('users:manage') },
    children: userRoutes,
  },
  {
    path: 'tenants',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('tenants:manage') },
    children: tenantRoutes,
  },

  // Admin routes
  {
    path: 'admin/activity-logs',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('clients:manage') },
    loadComponent: () =>
      import('./admin/admin-activity-logs/admin-activity-logs.component').then(
        (m) => m.AdminActivityLogsComponent
      ),
  },

  // Offer routes (issuance & presentation)
  {
    path: 'offer',
    canActivate: [AuthGuard],
    children: [
      {
        path: 'issuance',
        canActivate: [RoleGuard],
        data: { role: getRole('issuance:offer') },
        children: issuanceOfferRoutes,
      },
      {
        path: 'presentation',
        canActivate: [RoleGuard],
        data: { role: getRole('presentation:request') },
        children: presentationOfferRoutes,
      },
    ],
  },

  // Issuance routes
  {
    path: 'issuance-config',
    canActivate: [AuthGuard],
    children: issuanceConfigRoutes,
  },
  {
    path: 'credential-config',
    canActivate: [AuthGuard],
    children: credentialConfigRoutes,
  },
  {
    path: 'attribute-providers',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('issuance:manage') },
    children: attributeProviderRoutes,
  },
  {
    path: 'webhook-endpoints',
    canActivate: [AuthGuard],
    children: webhookEndpointRoutes,
  },

  // Key & Certificate routes
  {
    path: 'keys',
    canActivate: [AuthGuard],
    children: keyManagementRoutes,
  },
  {
    path: 'kms',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./key-management/key-management-providers/key-management-providers.component').then(
        (m) => m.KeyManagementProvidersComponent
      ),
  },

  // Registrar
  {
    path: 'registrar',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('registrar:manage') },
    loadComponent: () =>
      import('./registrar/registrar.component').then((m) => m.RegistrarComponent),
  },

  // Status list routes
  {
    path: 'status-lists',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('issuance:manage') },
    children: statusListRoutes,
  },
  {
    path: 'status-list-config',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('issuance:manage') },
    loadComponent: () =>
      import('./status-list-config/status-list-config.component').then(
        (m) => m.StatusListConfigComponent
      ),
  },

  // Session management routes
  {
    path: 'session-management',
    canActivate: [AuthGuard],
    children: sessionManagementRoutes,
  },

  // Presentation config routes
  {
    path: 'presentation-config',
    canActivate: [AuthGuard],
    children: presentationConfigRoutes,
  },

  // Trust list routes
  {
    path: 'trust-list',
    canActivate: [AuthGuard],
    children: trustListRoutes,
  },

  // Schema routes
  {
    path: 'schema',
    canActivate: [AuthGuard, RoleGuard],
    data: { role: getRole('registrar:manage') },
    children: schemaRoutes,
  },
  { path: 'schema-metadata', redirectTo: 'schema', pathMatch: 'full' },
  { path: 'schema-metadata/create', redirectTo: 'schema/create' },
  { path: 'schema-metadata/:id', redirectTo: 'schema/:id' },
];
