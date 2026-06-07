import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { StatusListConfigService, bitsOptions } from './status-list-config.service';
import { StatusListConfig } from '@eudiplo/sdk-core';

@Component({
  selector: 'app-status-list-config',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    FlexLayoutModule,
  ],
  templateUrl: './status-list-config.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './status-list-config.component.scss',
})
export class StatusListConfigComponent implements OnInit {
  configForm: FormGroup;
  isLoading = true;
  isSaving = false;
  currentConfig: StatusListConfig | null = null;

  bitsOptions = bitsOptions;
  Math = Math;

  constructor(
    private readonly fb: FormBuilder,
    private readonly statusListConfigService: StatusListConfigService,
    private readonly snackBar: MatSnackBar
  ) {
    this.configForm = this.fb.group({
      capacity: [null, [Validators.min(100)]],
      bits: [1],
      ttl: [null, [Validators.min(60)]],
      immediateUpdate: [false],
      enableAggregation: [true],
    });
  }

  ngOnInit() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    this.isLoading = true;
    try {
      this.currentConfig = await this.statusListConfigService.getConfig();
      this.configForm.patchValue({
        capacity: this.currentConfig?.capacity ?? null,
        bits: this.currentConfig?.bits ?? 1,
        ttl: this.currentConfig?.ttl ?? null,
        immediateUpdate: this.currentConfig?.immediateUpdate ?? false,
        enableAggregation: this.currentConfig?.enableAggregation ?? true,
      });
    } catch (error) {
      this.snackBar.open('Failed to load status list configuration', 'Close', {
        duration: 5000,
      });
      console.error('Load error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async onSave(): Promise<void> {
    if (this.configForm.invalid) {
      return;
    }

    this.isSaving = true;
    try {
      const formValue = this.configForm.value;
      // Convert empty string to null for capacity and ttl
      if (formValue.capacity === '' || formValue.capacity === null) {
        formValue.capacity = null;
      }
      if (formValue.ttl === '' || formValue.ttl === null) {
        formValue.ttl = null;
      }
      this.currentConfig = await this.statusListConfigService.updateConfig(formValue);
      this.snackBar.open('Status list configuration saved successfully', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      this.snackBar.open(
        error instanceof Error ? error.message : 'Failed to save configuration',
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.isSaving = false;
    }
  }

  async onReset(): Promise<void> {
    this.isSaving = true;
    try {
      await this.statusListConfigService.resetConfig();
      this.currentConfig = null;
      this.configForm.patchValue({
        capacity: null,
        bits: 1,
        ttl: null,
        immediateUpdate: false,
        enableAggregation: true,
      });
      this.snackBar.open('Status list configuration reset to defaults', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      this.snackBar.open(
        error instanceof Error ? error.message : 'Failed to reset configuration',
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.isSaving = false;
    }
  }

  formatCapacity(capacity?: number | null): string {
    if (!capacity) return 'Using global default (10,000)';
    return `${capacity.toLocaleString()} entries`;
  }

  formatTtl(ttl?: number | null): string {
    if (!ttl) return 'Using global default (1 hour)';
    if (ttl >= 3600) {
      const hours = ttl / 3600;
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    if (ttl >= 60) {
      const minutes = ttl / 60;
      return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    }
    return ttl === 1 ? '1 second' : `${ttl} seconds`;
  }

  getSelectedBitsLabel(): string {
    const value = this.configForm.get('bits')?.value;
    return this.bitsOptions.find((o) => o.value === value)?.label ?? '';
  }
}
