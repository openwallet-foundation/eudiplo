import { CommonModule } from '@angular/common';
import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { KeyChainResponseDto } from '@eudiplo/sdk-core';
import { KeyChainService } from '../key-chain.service';

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
  keyChain: KeyChainResponseDto;
}

interface UsageGroup {
  usage: KeyUsageType;
  label: string;
  icon: string;
  description: string;
  items: KeyDisplayItem[];
  expanded: boolean;
}

@Component({
  selector: 'app-key-management-list',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatExpansionModule,
    MatChipsModule,
    RouterModule,
    FlexLayoutModule,
  ],
  templateUrl: './key-management-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './key-management-list.component.scss',
})
export class KeyManagementListComponent implements OnInit {
  displayItems: KeyDisplayItem[] = [];
  usageGroups: UsageGroup[] = [];

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

      // Convert to display items
      this.displayItems = this.convertKeyChains(keyChains);

      this.buildUsageGroups();
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
      keyChain: kc,
    }));
  }

  collapseAll(): void {
    for (const group of this.usageGroups) {
      group.expanded = false;
    }
  }

  private buildUsageGroups(): void {
    const usageOrder: KeyUsageType[] = ['attestation', 'access', 'statusList', 'trustList'];

    // Group items by usage type
    const itemsByUsage = new Map<KeyUsageType, KeyDisplayItem[]>();

    for (const item of this.displayItems) {
      if (!itemsByUsage.has(item.usageType)) {
        itemsByUsage.set(item.usageType, []);
      }
      itemsByUsage.get(item.usageType)!.push(item);
    }

    // Build usage groups
    this.usageGroups = usageOrder
      .map((usage) => {
        const config = this.usageConfig[usage];
        const items = itemsByUsage.get(usage) || [];

        return {
          usage,
          label: config.label,
          icon: config.icon,
          description: config.description,
          items,
          expanded: items.length > 0,
        };
      })
      .filter((group) => group.items.length > 0);
  }

  getDisplayName(item: KeyDisplayItem): string {
    return item.description || item.id;
  }

  getTypeLabel(item: KeyDisplayItem): string {
    if (item.type === 'internalChain') {
      return item.rotationEnabled ? 'Internal Chain (Rotating)' : 'Internal Chain';
    }
    return item.rotationEnabled ? 'Standalone (Rotating)' : 'Standalone';
  }

  getTypeIcon(item: KeyDisplayItem): string {
    if (item.type === 'internalChain') {
      return 'account_tree';
    }
    return item.rotationEnabled ? 'autorenew' : 'key';
  }

  getTotalKeyCount(group: UsageGroup): number {
    return group.items.length;
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
