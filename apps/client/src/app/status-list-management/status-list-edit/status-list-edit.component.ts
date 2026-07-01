import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  StatusListResponseDto,
  CredentialConfig,
  KeyChainResponseDto,
  credentialConfigControllerGetConfigs,
  keyChainControllerGetAll,
} from '@eudiplo/sdk-core';
import { StatusListManagementService } from '../status-list-management.service';

@Component({
  selector: 'app-status-list-edit',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    FlexLayoutModule,
    RouterModule,
  ],
  templateUrl: './status-list-edit.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './status-list-edit.component.scss',
})
export class StatusListEditComponent implements OnInit {
  listId?: string | null;
  form!: FormGroup;
  isLoading = true;
  isSaving = false;

  /** The loaded status list (for edit mode) */
  statusList?: StatusListResponseDto;

  /** Available credential configs for binding */
  credentialConfigs: CredentialConfig[] = [];

  /** Available key chains with statusList or attestation usage */
  keyChains: KeyChainResponseDto[] = [];

  /** Available bits per status options */
  bitsOptions = [1, 2, 4, 8] as const;

  /** Available capacity presets */
  capacityPresets = [
    { value: 10000, label: '10K' },
    { value: 100000, label: '100K' },
    { value: 500000, label: '500K' },
    { value: 1000000, label: '1M' },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar,
    private readonly statusListService: StatusListManagementService
  ) {}

  ngOnInit(): void {
    this.listId = this.route.snapshot.paramMap.get('listId');

    this.form = new FormGroup({
      credentialConfigurationId: new FormControl(null),
      keyChainId: new FormControl(null),
      // Only used in create mode
      bits: new FormControl(null),
      capacity: new FormControl(null),
    });

    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.isLoading = true;
    try {
      const [configsResponse, keyChainResponse] = await Promise.all([
        credentialConfigControllerGetConfigs(),
        keyChainControllerGetAll({}),
      ]);

      this.credentialConfigs = configsResponse.data || [];
      this.keyChains = (keyChainResponse.data || []).filter(
        (kc: KeyChainResponseDto) => kc.usageType === 'statusList' || kc.usageType === 'attestation'
      );

      if (this.listId) {
        await this.loadStatusList();
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      this.snackBar.open('Failed to load data', 'Close', { duration: 5000 });
    } finally {
      this.isLoading = false;
    }
  }

  private async loadStatusList(): Promise<void> {
    if (!this.listId) return;

    try {
      this.statusList = await this.statusListService.getList(this.listId);
      this.form.patchValue({
        credentialConfigurationId: this.statusList.credentialConfigurationId ?? null,
        keyChainId: this.statusList.keyChainId ?? null,
      });
    } catch (error) {
      console.error('Failed to load status list:', error);
      this.snackBar.open('Failed to load status list', 'Close', { duration: 5000 });
      this.router.navigate(['/status-lists']);
    }
  }

  get isEditMode(): boolean {
    return !!this.listId;
  }

  getUsagePercentage(): number {
    if (!this.statusList) return 0;
    return this.statusListService.getUsagePercentage(this.statusList);
  }

  getUsageColor(): string {
    const percentage = this.getUsagePercentage();
    if (percentage >= 90) return 'warn';
    if (percentage >= 70) return 'accent';
    return 'primary';
  }

  formatCapacity(capacity: number): string {
    return this.statusListService.formatCapacity(capacity);
  }

  getExpirationStatus(): 'valid' | 'expiring' | 'expired' | 'none' {
    if (!this.statusList?.expiresAt) return 'none';
    const expiresAt = new Date(this.statusList.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    if (diffMs < 0) return 'expired';
    if (diffMs < 60 * 60 * 1000) return 'expiring';
    return 'valid';
  }

  getExpirationLabel(): string {
    const status = this.getExpirationStatus();
    switch (status) {
      case 'valid':
        return 'Valid';
      case 'expiring':
        return 'Expiring Soon';
      case 'expired':
        return 'Expired';
      default:
        return 'Not Generated';
    }
  }

  copyUri(): void {
    if (!this.statusList?.uri) return;
    navigator.clipboard.writeText(this.statusList.uri).then(() => {
      this.snackBar.open('URI copied to clipboard', 'Close', { duration: 2000 });
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    try {
      const formValue = this.form.value;

      if (this.isEditMode) {
        const dto = {
          credentialConfigurationId: formValue.credentialConfigurationId || undefined,
          keyChainId: formValue.keyChainId || undefined,
        };
        await this.statusListService.updateList(this.listId!, dto);
        this.snackBar.open('Status list updated successfully', 'Close', { duration: 3000 });
      } else {
        const dto = {
          credentialConfigurationId: formValue.credentialConfigurationId || undefined,
          keyChainId: formValue.keyChainId || undefined,
          bits: formValue.bits || undefined,
          capacity: formValue.capacity || undefined,
        };
        await this.statusListService.createList(dto);
        this.snackBar.open('Status list created successfully', 'Close', { duration: 3000 });
      }

      this.router.navigate(['/status-lists']);
    } catch (error) {
      console.error('Error saving status list:', error);
      this.snackBar.open('Failed to save status list', 'Close', { duration: 5000 });
    } finally {
      this.isSaving = false;
    }
  }
}
