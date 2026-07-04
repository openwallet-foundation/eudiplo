import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { KmsProviderInfoDto } from '@eudiplo/sdk-core';
import { KeyChainService } from '../key-chain.service';

interface ProviderHealthItem {
  providerId: string;
  type: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

interface ProviderRow {
  name: string;
  type: string;
  isDefault: boolean;
  canCreate: boolean;
  canImport: boolean;
  canDelete: boolean;
  supportedAlgs: string[];
  healthOk?: boolean;
  latencyMs?: number;
  healthError?: string;
}

@Component({
  selector: 'app-key-management-providers',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    RouterModule,
    FlexLayoutModule,
  ],
  templateUrl: './key-management-providers.component.html',
  styleUrl: './key-management-providers.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class KeyManagementProvidersComponent implements OnInit {
  isLoading = false;
  defaultProvider = 'db';
  rows: ProviderRow[] = [];
  displayedColumns = ['name', 'type', 'capabilities', 'algorithms', 'health', 'actions'];

  constructor(
    private readonly keyChainService: KeyChainService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadProviders();
  }

  async refresh(): Promise<void> {
    await this.loadProviders();
  }

  private async loadProviders(): Promise<void> {
    this.isLoading = true;
    try {
      const [providersRes, healthRes] = await Promise.all([
        this.keyChainService.getProviders(),
        this.keyChainService.getProvidersHealth(),
      ]);

      this.defaultProvider = providersRes.default;
      const healthByProvider = new Map<string, ProviderHealthItem>();
      for (const h of healthRes) {
        healthByProvider.set(h.providerId, h);
      }

      this.rows = providersRes.providers.map((provider) =>
        this.toRow(provider, healthByProvider.get(provider.name))
      );
    } catch (error) {
      console.error('Failed to load KMS providers:', error);
      this.snackBar.open('Failed to load KMS providers', 'Dismiss', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  private toRow(provider: KmsProviderInfoDto, health?: ProviderHealthItem): ProviderRow {
    return {
      name: provider.name,
      type: provider.type,
      isDefault: provider.name === this.defaultProvider,
      canCreate: provider.capabilities.canCreate,
      canImport: provider.capabilities.canImport,
      canDelete: provider.capabilities.canDelete,
      supportedAlgs: provider.capabilities.supportedAlgs,
      healthOk: health?.ok,
      latencyMs: health?.latencyMs,
      healthError: health?.error,
    };
  }
}
