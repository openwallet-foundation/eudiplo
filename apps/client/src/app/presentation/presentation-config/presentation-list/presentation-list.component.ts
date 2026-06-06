import { CommonModule } from '@angular/common';
import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { PresentationConfig } from '@eudiplo/sdk-core';
import { PresentationManagementService } from '../presentation-management.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  formatRegistrationCertExpiresIn,
  getRegistrationCertStatus,
  type RegistrationCertStatus,
} from '../../../utils/registration-cert-status';

@Component({
  selector: 'app-presentation-list',
  imports: [
    MatTableModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    RouterModule,
    FlexLayoutModule,
    MatTooltipModule,
  ],
  templateUrl: './presentation-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './presentation-list.component.scss',
})
export class PresentationListComponent implements OnInit {
  configurations: PresentationConfig[] = [];
  loading = false;

  displayedColumns: (keyof PresentationConfig | 'actions' | 'registrationCert')[] = [
    'id',
    'description',
    'createdAt',
    'registrationCert',
    'actions',
  ];

  constructor(
    private presentationService: PresentationManagementService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadConfigurations();
  }

  async loadConfigurations(): Promise<void> {
    this.loading = true;
    try {
      this.configurations = await this.presentationService.loadConfigurations();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      this.snackBar.open('Failed to load configurations', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  registrationCertStatus(config: PresentationConfig): RegistrationCertStatus {
    return getRegistrationCertStatus(config);
  }

  registrationCertTooltip(config: PresentationConfig): string {
    const status = this.registrationCertStatus(config);
    const expiresIn = formatRegistrationCertExpiresIn(config.registrationCertCache as any);
    switch (status) {
      case 'active':
        return expiresIn ? `Active — expires in ${expiresIn}` : 'Active';
      case 'expiring':
        return `Expiring soon — ${expiresIn} remaining`;
      case 'expired':
        return 'Expired — reissue required';
      case 'pending':
        return 'Pending — will be issued on next request';
      default:
        return 'No registration certificate configured';
    }
  }

  registrationCertIcon(status: RegistrationCertStatus): string {
    switch (status) {
      case 'active':
        return 'verified';
      case 'expiring':
        return 'schedule';
      case 'expired':
        return 'error_outline';
      case 'pending':
        return 'refresh';
      default:
        return 'remove';
    }
  }
}
