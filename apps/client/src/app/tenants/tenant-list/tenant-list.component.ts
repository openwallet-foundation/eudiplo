import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  tenantControllerDeleteTenant,
  tenantControllerGetTenants,
  TenantEntity,
} from '@eudiplo/sdk-core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-tenant-list',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    RouterModule,
    FlexLayoutModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  templateUrl: './tenant-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tenant-list.component.scss',
})
export class TenantListComponent implements OnInit {
  displayedColumns: (keyof TenantEntity | 'actions')[] = [
    'id',
    'name',
    'description',
    'status',
    'actions',
  ];
  tenants: TenantEntity[] = [];

  constructor(private snackBar: MatSnackBar) {}

  async ngOnInit(): Promise<void> {
    this.tenants = await tenantControllerGetTenants<true>().then((res) => res.data);
  }

  deleteTenant(tenant: TenantEntity): void {
    if (
      !confirm(
        `Are you sure you want to delete tenant ${tenant.name}? This action cannot be undone.`
      )
    ) {
      return;
    }
    tenantControllerDeleteTenant({ path: { id: tenant.id } }).then(() => {
      this.tenants = this.tenants.filter((t) => t.id !== tenant.id);
      this.snackBar.open('Tenant deleted successfully', 'Close', { duration: 3000 });
    });
  }
}
