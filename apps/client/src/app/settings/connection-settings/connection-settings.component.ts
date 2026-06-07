import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { ApiService } from '../../core';

@Component({
  selector: 'app-connection-settings',
  standalone: true,
  imports: [
    FlexLayoutModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    RouterModule,
  ],
  templateUrl: './connection-settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './connection-settings.component.scss',
})
export class ConnectionSettingsComponent {
  constructor(
    public apiService: ApiService,
    private readonly snackBar: MatSnackBar
  ) {}

  get currentBaseUrl(): string {
    return this.apiService.getBaseUrl() || 'Not configured';
  }

  get currentClientId(): string {
    return this.apiService.getClientId() || 'Not configured';
  }

  get currentClientSecret(): string {
    return this.apiService.getClientSecret() || 'Not configured';
  }

  get currentOidcUrl(): string {
    return this.apiService.getoidcUrl() || 'Not configured';
  }

  get canAutoRefresh(): boolean {
    return this.apiService.canRefreshToken();
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.snackBar.open(`${label} copied to clipboard!`, 'OK', {
        duration: 2000,
        panelClass: ['success-snackbar'],
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
      this.snackBar.open(`Failed to copy ${label}`, 'OK', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
    }
  }
}
