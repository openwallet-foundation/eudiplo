import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { KeyChainService } from '../key-chain.service';
import { KeyChainResponseDto, KeyChainUpdateDto, RotationPolicyUpdateDto } from '@eudiplo/sdk-core';

@Component({
  selector: 'app-key-management-create',
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatTooltipModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './key-management-create.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './key-management-create.component.scss',
})
export class KeyManagementCreateComponent implements OnInit {
  public form: FormGroup;
  public keyChainId?: string;
  public keyChain?: KeyChainResponseDto;
  public isLoading = false;

  constructor(
    private readonly keyChainService: KeyChainService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly fb: FormBuilder
  ) {
    this.keyChainId = this.route.snapshot.params['id'];
    this.form = this.fb.group({
      description: [''],
      // Rotation policy fields (only for internal chain type)
      rotationEnabled: [false],
      rotationIntervalDays: [30],
      certValidityDays: [365],
    });
  }

  ngOnInit(): void {
    if (this.keyChainId) {
      this.loadKeyChain();
    } else {
      // This component is now only for editing, redirect to wizard for create
      this.router.navigate(['/keys/create']);
    }
  }

  private async loadKeyChain(): Promise<void> {
    this.isLoading = true;
    try {
      this.keyChain = await this.keyChainService.getById(this.keyChainId!);

      this.form.patchValue({
        description: this.keyChain.description || '',
        rotationEnabled: this.keyChain.rotationPolicy?.enabled || false,
        rotationIntervalDays: this.keyChain.rotationPolicy?.intervalDays || 30,
        certValidityDays: this.keyChain.rotationPolicy?.certValidityDays || 365,
      });
    } catch (error) {
      console.error('Error loading key chain:', error);
      this.snackBar.open('Failed to load key chain', 'Close', { duration: 3000 });
      this.router.navigate(['../'], { relativeTo: this.route });
    } finally {
      this.isLoading = false;
    }
  }

  get isInternalChain(): boolean {
    return this.keyChain?.type === 'internalChain';
  }

  async onSubmit(): Promise<void> {
    try {
      const updateDto: KeyChainUpdateDto = {
        description: this.form.get('description')?.value || undefined,
      };

      // Only include rotation policy updates for internal chain
      if (this.isInternalChain) {
        updateDto.rotationPolicy = this.buildRotationPolicy();
      }

      await this.keyChainService.update(this.keyChainId!, updateDto);
      this.snackBar.open('Key chain updated successfully', 'Close', {
        duration: 3000,
      });

      this.router.navigate(['../'], { relativeTo: this.route });
    } catch (error) {
      console.error('Error updating key chain:', error);
      this.snackBar.open('Failed to update key chain', 'Close', {
        duration: 3000,
      });
    }
  }

  /**
   * Build rotation policy update DTO from form values.
   */
  private buildRotationPolicy(): RotationPolicyUpdateDto {
    const policy: RotationPolicyUpdateDto = {
      enabled: this.form.value.rotationEnabled || false,
    };

    if (policy.enabled) {
      if (this.form.value.rotationIntervalDays) {
        policy.intervalDays = this.form.value.rotationIntervalDays;
      }
      if (this.form.value.certValidityDays) {
        policy.certValidityDays = this.form.value.certValidityDays;
      }
    }

    return policy;
  }
}
