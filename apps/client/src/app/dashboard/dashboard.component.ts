import { Component, type OnDestroy, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { EnvironmentService } from '../services/environment.service';
import { JwtService } from '../services/jwt.service';
import { GrafanaLinkService } from '../services/grafana-link.service';
import { appControllerGetVersion } from '@eudiplo/sdk-core';
import { ApiService } from '../core';
import { MatGridListModule } from '@angular/material/grid-list';
import { DashboardService } from './dashboard.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    FlexLayoutModule,
    MatCardModule,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatGridListModule,
    DatePipe,
    RouterModule,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly refreshInterval?: NodeJS.Timeout;
  private tokenCheckInterval?: NodeJS.Timeout;
  backendVersion: string | null = null;
  clientVersion: string | null = null;
  grafanaEnabled = false;

  constructor(
    public apiService: ApiService,
    public environmentService: EnvironmentService,
    public dashboardService: DashboardService,
    public grafanaLinkService: GrafanaLinkService,
    public jwtService: JwtService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Check token status periodically (every 30 seconds)
    this.tokenCheckInterval = setInterval(() => {
      this.checkTokenStatus();
    }, 30000);

    // Initial check
    this.checkTokenStatus();

    // Fetch versions
    this.fetchBackendVersion();
    this.fetchClientVersion();

    // Fetch dashboard stats
    this.dashboardService.getCounters();

    // Load Grafana config
    this.grafanaLinkService.getConfig().then(() => {
      this.grafanaEnabled = this.grafanaLinkService.isEnabled();
    });
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval);
    }
  }

  /**
   * Check token status and show warnings if needed
   */
  private checkTokenStatus(): void {
    if (!this.apiService.getAuthenticationStatus()) {
      // Token has expired, redirect to login
      this.snackBar
        .open('Your session has expired. Please login again.', 'Login', {
          duration: 0, // Don't auto-dismiss
          panelClass: ['error-snackbar'],
        })
        .onAction()
        .subscribe(() => {
          this.apiService.logout();
          this.router.navigate(['/login']);
        });
      return;
    }

    // Check if token is expiring soon (within 5 minutes) and can't auto-refresh
    const timeRemaining = this.apiService.getTokenTimeRemaining();
    if (timeRemaining < 300000 && !this.canAutoRefresh) {
      // 5 minutes
      const minutes = Math.floor(timeRemaining / 60000);
      this.snackBar.open(`Token expires in ${minutes} minutes. Please save your work.`, 'OK', {
        duration: 10000,
        panelClass: ['warning-snackbar'],
      });
    }
  }

  get currentBaseUrl(): string {
    return this.apiService.getBaseUrl() || 'Not configured';
  }

  get canAutoRefresh(): boolean {
    return this.apiService.canRefreshToken();
  }

  /**
   * Fetch backend version from the API
   */
  private async fetchBackendVersion(): Promise<void> {
    try {
      const response = await appControllerGetVersion();
      if (response.data && typeof response.data === 'object' && 'version' in response.data) {
        this.backendVersion = (response.data as any).version;
      }
    } catch (error) {
      console.error('Failed to fetch backend version:', error);
      this.backendVersion = 'Unknown';
    }
  }

  /**
   * Fetch client version from runtime environment
   */
  private fetchClientVersion(): void {
    const env = (window as any)['env'];
    this.clientVersion = env?.version || 'dev';
  }

  openGrafana(): void {
    const url = this.grafanaLinkService.getBaseUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
