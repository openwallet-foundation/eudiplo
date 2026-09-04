import { CommonModule } from '@angular/common';
import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { KeyChainResponseDto } from '@eudiplo/sdk-core';
import { KeyChainService } from '../key-chain.service';
import { ConfigOwnershipDirective } from '../../config-portability/config-ownership.directive';

type KeyUsageType = 'attestation' | 'statusList' | 'access' | 'trustList';

/**
 * Display item for key chains.
 */
interface KeyDisplayItem {
  id: string;
  description?: string;
  usageType: KeyUsageType;
  type: 'internalChain' | 'standalone';
  rotationEnabled: boolean;
  hasRootCa: boolean;
  kmsProvider: string;
  keyChain: KeyChainResponseDto;
}

@Component({
  selector: 'app-key-management-list',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatChipsModule,
    RouterModule,
    FlexLayoutModule,
    ConfigOwnershipDirective,
  ],
  templateUrl: './key-management-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './key-management-list.component.scss',
})
export class KeyManagementListComponent implements OnInit {
  displayItems: KeyDisplayItem[] = [];
  filteredItems: KeyDisplayItem[] = [];
  displayedColumns: string[] = [
    'usage',
    'name',
    'type',
    'kmsProvider',
    'rotation',
    'id',
    'actions',
  ];

  selectedUsageType = '';
  selectedKeyType = '';
  selectedKmsProvider = '';
  availableKmsProviders: string[] = [];

  private readonly usageConfig: Record<
    KeyUsageType,
    { label: string; icon: string; description: string }
  > = {
    attestation: {
      label: 'Credential Signing Keys',
      icon: 'verified_user',
      description:
        'Keys for signing Electronic Attestations of Attributes (EAAs) issued to wallets. Each credential type has its own isolated key chain.',
    },
    access: {
      label: 'EUDI Wallet Access Certificate Keys',
      icon: 'vpn_key',
      description: 'Keys for EUDI Wallet Access Certificates to authenticate to the wallet.',
    },
    statusList: {
      label: 'Status List Keys',
      icon: 'fact_check',
      description: 'Keys for signing credential status lists (revocation/suspension).',
    },
    trustList: {
      label: 'Trust List Keys',
      icon: 'shield',
      description: 'Keys for signing trust list entries.',
    },
  };

  constructor(
    private readonly keyChainService: KeyChainService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadAllKeys();
  }

  private async loadAllKeys(): Promise<void> {
    try {
      const keyChains = await this.keyChainService.getAll();

      this.displayItems = this.convertKeyChains(keyChains);
      this.availableKmsProviders = [...new Set(this.displayItems.map((item) => item.kmsProvider))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      this.applyFilters();
    } catch (error) {
      console.error('Error loading keys:', error);
      this.snackBar.open('Failed to load keys', 'Dismiss', { duration: 5000 });
    }
  }

  private convertKeyChains(keyChains: KeyChainResponseDto[]): KeyDisplayItem[] {
    return keyChains.map((kc) => ({
      id: kc.id,
      description: kc.description,
      usageType: kc.usageType as KeyUsageType,
      type: kc.type,
      rotationEnabled: kc.rotationPolicy?.enabled || false,
      hasRootCa: kc.type === 'internalChain' && !!kc.rootCertificate,
      kmsProvider: kc.kmsProvider,
      keyChain: kc,
    }));
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.selectedUsageType = '';
    this.selectedKeyType = '';
    this.selectedKmsProvider = '';
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredItems = this.displayItems.filter((item) => {
      const usageMatches = !this.selectedUsageType || item.usageType === this.selectedUsageType;
      const typeMatches = !this.selectedKeyType || item.type === this.selectedKeyType;
      const kmsMatches = !this.selectedKmsProvider || item.kmsProvider === this.selectedKmsProvider;

      return usageMatches && typeMatches && kmsMatches;
    });
  }

  getDisplayName(item: KeyDisplayItem): string {
    return item.description || item.id;
  }

  getUsageLabel(item: KeyDisplayItem): string {
    return this.usageConfig[item.usageType]?.label ?? item.usageType;
  }

  getUsageIcon(item: KeyDisplayItem): string {
    return this.usageConfig[item.usageType]?.icon ?? 'key';
  }

  getTypeLabel(item: KeyDisplayItem): string {
    return item.type === 'internalChain' ? 'Internal Chain' : 'Standalone';
  }

  getTypeIcon(item: KeyDisplayItem): string {
    if (item.type === 'internalChain') {
      return 'account_tree';
    }
    return item.rotationEnabled ? 'autorenew' : 'key';
  }

  /**
   * Get the route path for viewing a key chain.
   */
  getViewRoute(item: KeyDisplayItem): string[] {
    return [item.id];
  }

  async deleteItem(item: KeyDisplayItem, event: Event): Promise<void> {
    event.stopPropagation();

    if (!confirm(`Delete "${this.getDisplayName(item)}"? This cannot be undone.`)) {
      return;
    }

    try {
      await this.keyChainService.delete(item.id);
      this.snackBar.open('Key chain deleted', 'Dismiss', { duration: 3000 });
      await this.loadAllKeys();
    } catch (error) {
      console.error('Error deleting key chain:', error);
      this.snackBar.open('Failed to delete key chain', 'Dismiss', { duration: 5000 });
    }
  }

  async rotateItem(item: KeyDisplayItem, event: Event): Promise<void> {
    event.stopPropagation();

    if (!item.rotationEnabled) {
      this.snackBar.open('Rotation not enabled for this key chain', 'Dismiss', { duration: 3000 });
      return;
    }

    try {
      await this.keyChainService.rotate(item.id);
      this.snackBar.open('Key chain rotated', 'Dismiss', { duration: 3000 });
      await this.loadAllKeys();
    } catch (error) {
      console.error('Error rotating key chain:', error);
      this.snackBar.open('Failed to rotate key chain', 'Dismiss', { duration: 5000 });
    }
  }
}
