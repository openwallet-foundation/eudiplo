import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { KeyChainService } from '../key-chain.service';
import { RegistrarConfig, RegistrarService } from '../../registrar/registrar.service';
import { KeyChainCreateDto } from '@eudiplo/sdk-core';

export type KeyUsageSelection = 'attestation' | 'statusList' | 'access' | 'trustList';
export type KeyChainTypeSelection = 'internalChain' | 'standalone';
export type AccessSourceSelection = 'selfSigned' | 'registrar';

@Component({
  selector: 'app-key-create-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatSnackBarModule,
    MatStepperModule,
    MatTooltipModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './key-create-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './key-create-wizard.component.scss',
})
export class KeyCreateWizardComponent implements OnInit {
  @ViewChild('stepper') stepper!: MatStepper;

  // Form groups for each step
  usageForm: FormGroup;
  caSourceForm: FormGroup;
  accessSourceForm: FormGroup;
  configForm: FormGroup;

  isSubmitting = false;
  isCheckingRegistrar = false;
  registrarConfig: RegistrarConfig | null = null;
  registrarConfigChecked = false;

  // Usage options with descriptions
  usageOptions = [
    {
      value: 'attestation' as KeyUsageSelection,
      label: 'Credential Signing (Attestation)',
      icon: 'verified_user',
      description: 'Create a key for signing verifiable credentials (SD-JWT VC, mDOC).',
      hint: 'Create one key per credential type (e.g., diplomas, membership cards)',
    },
    {
      value: 'statusList' as KeyUsageSelection,
      label: 'Status List Signing',
      icon: 'playlist_add_check',
      description: 'Create a key for signing revocation/suspension status lists.',
      hint: 'Create one per credential type to manage its lifecycle separately',
    },
    {
      value: 'access' as KeyUsageSelection,
      label: 'Access Certificate',
      icon: 'badge',
      description: 'Prove your identity as an issuer/verifier to EUDI wallets.',
      hint: 'Self-signed for development or obtained through registrar enrollment',
    },
    {
      value: 'trustList' as KeyUsageSelection,
      label: 'Trust List Signing',
      icon: 'shield',
      description: 'Create a key for signing trust lists.',
      hint: 'For trust framework operators only',
    },
  ];

  // CA source options (shown for attestation keys only)
  keyChainTypeOptions = [
    {
      value: 'internalChain' as KeyChainTypeSelection,
      label: 'Create Key Chain (Recommended)',
      icon: 'account_tree',
      description: 'Create a key chain with embedded root CA and rotating signing key.',
      hint: 'Recommended for production. Each credential type gets its own isolated trust chain.',
      features: ['Automatic certificate rotation', 'Embedded root CA', 'Full lifecycle management'],
    },
    {
      value: 'standalone' as KeyChainTypeSelection,
      label: 'Standalone Key',
      icon: 'key',
      description: 'Create a self-signed standalone key.',
      hint: 'For simple setups or external PKI integration.',
      features: ['Self-signed certificate', 'Manual certificate management', 'Simple setup'],
    },
  ];

  // Access source options (shown for access keys)
  accessSourceOptions = [
    {
      value: 'selfSigned' as AccessSourceSelection,
      label: 'Self-Signed Certificate',
      icon: 'key',
      description: 'Create a self-signed access certificate for development or testing.',
      hint: 'Quick setup, no registrar required. Suitable for dev/test environments.',
    },
    {
      value: 'registrar' as AccessSourceSelection,
      label: 'Registrar Enrollment',
      icon: 'verified',
      description: 'Obtain a certificate through your registrar.',
      hint: 'Required for production. Provides a trusted certificate chain.',
    },
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly keyChainService: KeyChainService,
    private readonly registrarService: RegistrarService,
    private readonly router: Router,
    private readonly snackBar: MatSnackBar
  ) {
    // Step 1: Usage selection
    this.usageForm = this.fb.group({
      usage: ['', Validators.required],
    });

    // Step 2a: Key chain type selection (internal chain vs standalone, for attestation)
    this.caSourceForm = this.fb.group({
      keyChainType: ['internalChain', Validators.required],
    });

    // Step 2b: Access source selection (self-signed vs registrar)
    this.accessSourceForm = this.fb.group({
      accessSource: ['selfSigned', Validators.required],
    });

    // Step 3: Configuration
    this.configForm = this.fb.group({
      // Description for the key chain
      description: [''],
      // Rotation settings (only for internal chain)
      rotationEnabled: [true],
      rotationIntervalDays: [30, [Validators.min(1)]],
      certValidityDays: [365, [Validators.min(1)]],
    });
  }

  ngOnInit(): void {
    // Pre-check registrar config so we can show status quickly
    this.checkRegistrarConfig();
  }

  /**
   * Check if registrar credentials are configured.
   */
  async checkRegistrarConfig(): Promise<void> {
    this.isCheckingRegistrar = true;
    try {
      this.registrarConfig = await this.registrarService.getConfig();
    } catch {
      this.registrarConfig = null;
    } finally {
      this.isCheckingRegistrar = false;
      this.registrarConfigChecked = true;
    }
  }

  /**
   * Check if registrar is configured and ready to use.
   */
  get hasRegistrarConfig(): boolean {
    return this.registrarConfig !== null;
  }

  get selectedUsage(): KeyUsageSelection | null {
    return this.usageForm.get('usage')?.value || null;
  }

  get selectedKeyChainType(): KeyChainTypeSelection {
    return this.caSourceForm.get('keyChainType')?.value || 'internalChain';
  }

  get selectedAccessSource(): AccessSourceSelection {
    return this.accessSourceForm.get('accessSource')?.value || 'selfSigned';
  }

  get showKeyChainTypeStep(): boolean {
    // Only attestation keys need to choose key chain type
    return this.selectedUsage === 'attestation';
  }

  get showAccessSourceStep(): boolean {
    return this.selectedUsage === 'access';
  }

  get showConfigStep(): boolean {
    // Access certificates via registrar are created in this wizard if registrar is configured
    if (this.selectedUsage === 'access' && this.selectedAccessSource === 'registrar') {
      return this.hasRegistrarConfig;
    }
    return !!this.selectedUsage;
  }

  get isInternalChain(): boolean {
    return this.selectedUsage === 'attestation' && this.selectedKeyChainType === 'internalChain';
  }

  get rotationEnabled(): boolean {
    // Rotation can be enabled for internal chain keys
    return this.isInternalChain && this.configForm.value.rotationEnabled;
  }

  /**
   * Get the appropriate next step label based on current selection.
   */
  getNextStepLabel(): string {
    if (!this.selectedUsage) return 'Next';
    if (this.showKeyChainTypeStep || this.showAccessSourceStep) return 'Next';
    return 'Configure Key';
  }

  /**
   * Handle usage selection and advance to next step.
   */
  onUsageNext(): void {
    this.stepper.next();
  }

  /**
   * Handle access source selection and advance to next step.
   * For registrar enrollment, we stay in the wizard if credentials are configured.
   */
  onAccessSourceNext(): void {
    if (this.selectedAccessSource === 'registrar') {
      if (!this.hasRegistrarConfig) {
        // Config not yet set - user can go to registrar page via UI link
        // but we don't force navigation automatically
        this.snackBar
          .open('Please configure registrar credentials first', 'Go to Registrar', {
            duration: 5000,
          })
          .onAction()
          .subscribe(() => {
            this.router.navigate(['/registrar']);
          });
        return;
      }
    }
    this.stepper.next();
  }

  /**
   * Create the key chain based on wizard selections.
   * For registrar enrollment, creates the key then requests a certificate.
   */
  async createKey(): Promise<void> {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    try {
      const usage = this.selectedUsage!;
      const description = this.configForm.value.description?.trim();
      const isRegistrarEnrollment = usage === 'access' && this.selectedAccessSource === 'registrar';

      // Build the KeyChainCreateDto
      const createDto: KeyChainCreateDto = {
        usageType: usage,
        type: usage === 'access' || !this.isInternalChain ? 'standalone' : 'internalChain',
        description: description || this.getDefaultDescription(),
        kmsProvider: 'db', // Default to database storage
        rotationPolicy: {
          enabled: this.rotationEnabled,
          intervalDays: this.rotationEnabled
            ? this.configForm.value.rotationIntervalDays
            : undefined,
          certValidityDays: this.configForm.value.certValidityDays,
        },
      };

      const result = await this.keyChainService.create(createDto);

      // For registrar enrollment, request the certificate after creating the key
      if (isRegistrarEnrollment) {
        try {
          await this.registrarService.createAccessCertificate(result.id);
          this.snackBar.open(
            'Access certificate enrolled via registrar successfully!',
            'View Key',
            { duration: 5000 }
          );
        } catch (error: any) {
          console.error('Error enrolling certificate:', error);
          const message = error.error?.message || 'Failed to enroll certificate from registrar';
          this.snackBar.open(`Key created, but enrollment failed: ${message}`, 'View Key', {
            duration: 8000,
          });
        }
        this.router.navigate(['/keys', result.id]);
        return;
      }

      // Show success message with next steps
      this.showSuccessMessage(usage);
      this.router.navigate(['/keys', result.id]);
    } catch (error) {
      console.error('Error creating key chain:', error);
      this.snackBar.open('Failed to create key chain', 'Close', { duration: 3000 });
    } finally {
      this.isSubmitting = false;
    }
  }

  private showSuccessMessage(usage: KeyUsageSelection): void {
    if (usage === 'attestation') {
      if (this.isInternalChain) {
        this.snackBar
          .open(
            'Key chain created with embedded root CA! Next: Create a status list key.',
            'Create Status List Key',
            { duration: 8000 }
          )
          .onAction()
          .subscribe(() => {
            this.router.navigate(['/keys/create']);
          });
      } else {
        this.snackBar.open(
          'Standalone key created! You can configure certificates in the key details.',
          'View Key',
          { duration: 5000 }
        );
      }
    } else if (usage === 'statusList') {
      this.snackBar.open(
        'Status list key created! Your credential type setup is complete.',
        'View Key',
        { duration: 5000 }
      );
    } else if (usage === 'access') {
      this.snackBar.open(
        'Access certificate created! You can use this for wallet communication.',
        'View Key',
        { duration: 5000 }
      );
    } else if (usage === 'trustList') {
      this.snackBar
        .open(
          'Trust list key created! You can now configure your trust list.',
          'Go to Trust List',
          { duration: 5000 }
        )
        .onAction()
        .subscribe(() => {
          this.router.navigate(['/trust-list']);
        });
    }
  }

  /**
   * Generate a default description based on selections.
   */
  getDefaultDescription(): string {
    const usage = this.selectedUsage;

    if (usage === 'trustList') return 'Trust List Signing Key';
    if (usage === 'statusList') return 'Status List Signing Key';
    if (usage === 'attestation') return 'Credential Signing Key';
    if (usage === 'access') return 'Access Certificate';
    return 'Key';
  }

  /**
   * Get summary text for review.
   */
  getSummary(): { label: string; value: string }[] {
    const summary = [];
    const usage = this.usageOptions.find((u) => u.value === this.selectedUsage);

    summary.push({ label: 'Usage', value: usage?.label || '' });

    if (this.showKeyChainTypeStep) {
      const keyChainType = this.keyChainTypeOptions.find(
        (c) => c.value === this.selectedKeyChainType
      );
      summary.push({ label: 'Key Chain Type', value: keyChainType?.label || '' });
    }

    if (this.selectedUsage === 'access') {
      const certSource =
        this.selectedAccessSource === 'registrar' ? 'Registrar Enrollment' : 'Self-Signed';
      summary.push({ label: 'Certificate', value: certSource });
    }

    if (this.configForm.value.description) {
      summary.push({ label: 'Description', value: this.configForm.value.description });
    }

    if (this.isInternalChain) {
      summary.push({ label: 'Type', value: 'Internal Chain (Root CA + Signing Key)' });
      if (this.rotationEnabled) {
        summary.push({
          label: 'Rotation Interval',
          value: `${this.configForm.value.rotationIntervalDays} days`,
        });
      }
      summary.push({
        label: 'Certificate Validity',
        value: `${this.configForm.value.certValidityDays} days`,
      });
    } else {
      summary.push({ label: 'Type', value: 'Standalone (Self-signed)' });
    }

    return summary;
  }
}
