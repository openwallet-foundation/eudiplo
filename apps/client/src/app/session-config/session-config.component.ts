import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { SessionConfigService, cleanupModes } from './session-config.service';
import { SessionStorageConfig } from '@eudiplo/sdk-core';

@Component({
  selector: 'app-session-config',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    FlexLayoutModule,
  ],
  templateUrl: './session-config.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './session-config.component.scss',
})
export class SessionConfigComponent implements OnInit {
  configForm: FormGroup;
  isLoading = true;
  isSaving = false;
  currentConfig: SessionStorageConfig | null = null;

  cleanupModes = cleanupModes;

  constructor(
    private readonly fb: FormBuilder,
    private readonly sessionConfigService: SessionConfigService,
    private readonly snackBar: MatSnackBar
  ) {
    this.configForm = this.fb.group({
      ttlSeconds: [null, [Validators.min(60)]],
      cleanupMode: ['full'],
    });
  }

  ngOnInit() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    this.isLoading = true;
    try {
      this.currentConfig = await this.sessionConfigService.getConfig();
      this.configForm.patchValue({
        ttlSeconds: this.currentConfig?.ttlSeconds ?? null,
        cleanupMode: this.currentConfig?.cleanupMode ?? 'full',
      });
    } catch (error) {
      this.snackBar.open('Failed to load session configuration', 'Close', {
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
      // Convert empty string to null for ttlSeconds
      if (formValue.ttlSeconds === '' || formValue.ttlSeconds === null) {
        formValue.ttlSeconds = null;
      }
      this.currentConfig = await this.sessionConfigService.updateConfig(formValue);
      this.snackBar.open('Session configuration saved successfully', 'Close', {
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
      await this.sessionConfigService.resetConfig();
      this.currentConfig = null;
      this.configForm.patchValue({
        ttlSeconds: null,
        cleanupMode: 'full',
      });
      this.snackBar.open('Session configuration reset to defaults', 'Close', {
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

  formatTtl(seconds?: number | null): string {
    if (!seconds) return 'Using global default (24 hours)';
    if (seconds < 3600) return `${seconds} seconds`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }

  getSelectedModeLabel(): string {
    const value = this.configForm.get('cleanupMode')?.value;
    return this.cleanupModes.find((m) => m.value === value)?.label ?? '';
  }
}
