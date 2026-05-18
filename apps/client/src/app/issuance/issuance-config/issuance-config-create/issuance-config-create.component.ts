import { Component, type OnInit, type OnDestroy } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormBuilder,
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { IssuanceDto } from '@eudiplo/sdk-core';
import { IssuanceConfigService } from '../issuance-config.service';
import { issuanceConfigSchema } from '../../../utils/schemas';
import { JsonViewDialogComponent } from '../../credential-config/credential-config-create/json-view-dialog/json-view-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ImageFieldComponent } from '../../../utils/image-field/image-field.component';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-issuance-config-create',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatCheckboxModule,
    MatChipsModule,
    MatExpansionModule,
    MatTooltipModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    RouterModule,
    MatSlideToggleModule,
    MatSlideToggle,
    ImageFieldComponent,
  ],
  templateUrl: './issuance-config-create.component.html',
  styleUrl: './issuance-config-create.component.scss',
})
export class IssuanceConfigCreateComponent implements OnInit, OnDestroy {
  public form: FormGroup;
  public loading = false;
  private chainedAsEnabledSub?: Subscription;
  private readonly federationModes = ['federation-only', 'hybrid'] as const;

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private normalizeFederationMode(value: unknown): 'federation-only' | 'hybrid' {
    return this.federationModes.includes(value as (typeof this.federationModes)[number])
      ? (value as 'federation-only' | 'hybrid')
      : 'hybrid';
  }

  constructor(
    private readonly issuanceConfigService: IssuanceConfigService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly fb: FormBuilder
  ) {
    this.form = new FormGroup({
      display: this.fb.array([]),
      authServers: this.fb.array([]),
      preferredAuthServer: new FormControl(''),
      batchSize: new FormControl(1, [Validators.min(1)]),
      dPopRequired: new FormControl(false),
      refreshTokenEnabled: new FormControl(true),
      refreshTokenExpiresInSeconds: new FormControl(2592000, [Validators.min(1)]),
      txCodeMaxAttempts: new FormControl<number | null>(null, [Validators.min(1)]),
      credentialResponseEncryption: new FormControl(false),
      credentialRequestEncryption: new FormControl(false),
      walletAttestationRequired: new FormControl(false),
      walletProviderTrustLists: this.fb.array([]),
      chainedAs: this.fb.group({
        enabled: [false],
        upstream: this.fb.group({
          issuer: [''],
          clientId: [''],
          clientSecret: [''],
          scopes: [['openid', 'profile', 'email']],
        }),
        token: this.fb.group({
          lifetimeSeconds: [3600],
          signingKeyId: [''],
        }),
        requireDPoP: [false],
      }),
      federation: this.fb.group({
        enabled: [false],
        role: ['leaf'],
        mode: ['hybrid'],
        entityId: [''],
        enforceSigningPolicy: [true],
        cacheTtlSeconds: [300],
        trustAnchors: this.fb.array([]),
      }),
    } as { [k in keyof IssuanceDto]: any });
  }

  ngOnInit(): void {
    this.setupChainedAsValidation();
    this.loadConfigForEdit();
  }

  ngOnDestroy(): void {
    this.chainedAsEnabledSub?.unsubscribe();
  }

  /**
   * Dynamically add/remove required validators on chained AS upstream fields
   * based on the enabled toggle.
   */
  private setupChainedAsValidation(): void {
    const enabledControl = this.chainedAs.get('enabled');
    const upstreamGroup = this.chainedAs.get('upstream') as FormGroup;
    const issuerControl = upstreamGroup.get('issuer')!;
    const clientIdControl = upstreamGroup.get('clientId')!;

    const updateValidators = (enabled: boolean) => {
      if (enabled) {
        issuerControl.setValidators([Validators.required]);
        clientIdControl.setValidators([Validators.required]);
      } else {
        issuerControl.clearValidators();
        clientIdControl.clearValidators();
      }
      issuerControl.updateValueAndValidity();
      clientIdControl.updateValueAndValidity();
    };

    // Set initial state
    updateValidators(enabledControl?.value ?? false);

    // React to toggle changes
    this.chainedAsEnabledSub = enabledControl?.valueChanges.subscribe((enabled: boolean) => {
      updateValidators(enabled);
    });
  }

  private async loadConfigForEdit(): Promise<void> {
    try {
      const config = await this.issuanceConfigService.getConfig();
      if (!config) {
        this.snackBar.open('Configuration not found', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['../'], { relativeTo: this.route });
        return;
      }

      // Load display configurations
      const displayArray = this.form.get('display') as FormArray;
      displayArray.clear();
      if (config.display && Array.isArray(config.display)) {
        for (const entry of config.display) {
          const displayEntry = this.asRecord(entry);
          const logo = this.asRecord(displayEntry['logo']);
          displayArray.push(
            this.fb.group({
              name: [
                typeof displayEntry['name'] === 'string' ? displayEntry['name'] : '',
                Validators.required,
              ],
              locale: [
                typeof displayEntry['locale'] === 'string' ? displayEntry['locale'] : '',
                Validators.required,
              ],
              logo: this.fb.group({
                uri: [typeof logo['uri'] === 'string' ? logo['uri'] : '', Validators.required],
              }),
            })
          );
        }
      }

      // Load auth servers
      const authServersArray = this.form.get('authServers') as FormArray;
      authServersArray.clear();
      if (config.authServers && Array.isArray(config.authServers)) {
        for (const server of config.authServers) {
          authServersArray.push(new FormControl(server, [Validators.required]));
        }
      }

      // Load wallet provider trust lists
      const walletTrustListsArray = this.form.get('walletProviderTrustLists') as FormArray;
      walletTrustListsArray.clear();
      if (config.walletProviderTrustLists && Array.isArray(config.walletProviderTrustLists)) {
        for (const url of config.walletProviderTrustLists) {
          walletTrustListsArray.push(new FormControl(url, [Validators.required]));
        }
      }

      // Patch other form values
      this.form.patchValue({
        batchSize: config.batchSize,
        dPopRequired: config.dPopRequired,
        refreshTokenEnabled: config.refreshTokenEnabled ?? true,
        refreshTokenExpiresInSeconds: config.refreshTokenExpiresInSeconds ?? 2592000,
        credentialResponseEncryption:
          (config as { credentialResponseEncryption?: boolean }).credentialResponseEncryption ??
          false,
        credentialRequestEncryption:
          (config as { credentialRequestEncryption?: boolean }).credentialRequestEncryption ??
          false,
        walletAttestationRequired: config.walletAttestationRequired ?? false,
        preferredAuthServer: config.preferredAuthServer ?? '',
        txCodeMaxAttempts: config.txCodeMaxAttempts ?? null,
      });

      // Load Chained AS config if present
      if (config.chainedAs) {
        this.form.patchValue({
          chainedAs: {
            enabled: config.chainedAs.enabled ?? false,
            upstream: {
              issuer: config.chainedAs.upstream?.issuer ?? '',
              clientId: config.chainedAs.upstream?.clientId ?? '',
              clientSecret: config.chainedAs.upstream?.clientSecret ?? '',
              scopes: config.chainedAs.upstream?.scopes ?? ['openid', 'profile', 'email'],
            },
            token: {
              lifetimeSeconds: config.chainedAs.token?.lifetimeSeconds ?? 3600,
              signingKeyId: config.chainedAs.token?.signingKeyId ?? '',
            },
            requireDPoP: config.chainedAs.requireDPoP ?? false,
          },
        });
      }

      // Load Federation config if present
      if (config && (config as any)['federation']) {
        const federation = (config as any)['federation'];
        this.trustAnchors.clear();
        if (federation.trustAnchors && Array.isArray(federation.trustAnchors)) {
          for (const anchor of federation.trustAnchors) {
            this.trustAnchors.push(
              this.fb.group({
                entityId: [anchor.entityId ?? '', Validators.required],
                entityConfigurationUri: [anchor.entityConfigurationUri ?? '', Validators.required],
              })
            );
          }
        }
        this.form.patchValue({
          federation: {
            enabled: this.trustAnchors.length > 0,
            role: (federation.role as 'trust_anchor' | 'intermediate' | 'leaf') ?? 'leaf',
            mode: this.normalizeFederationMode(federation.mode),
            entityId: federation.entityId ?? '',
            enforceSigningPolicy: federation.enforceSigningPolicy ?? true,
            cacheTtlSeconds: federation.cacheTtlSeconds ?? 300,
          },
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.snackBar.open('Failed to load configuration', 'Close', {
        duration: 3000,
      });
    }
  }

  onSubmit(): void {
    this.loading = true;
    const formValue = this.form.value;

    // Build chainedAs config only if enabled, otherwise explicitly set to null to clear it
    let chainedAsConfig: IssuanceDto['chainedAs'] | null = null;
    if (formValue.chainedAs?.enabled) {
      chainedAsConfig = {
        enabled: true,
        upstream: {
          issuer: formValue.chainedAs.upstream.issuer,
          clientId: formValue.chainedAs.upstream.clientId,
          clientSecret: formValue.chainedAs.upstream.clientSecret,
          scopes: formValue.chainedAs.upstream.scopes,
        },
        token: {
          lifetimeSeconds: formValue.chainedAs.token.lifetimeSeconds || 3600,
          signingKeyId: formValue.chainedAs.token.signingKeyId || undefined,
        },
        requireDPoP: formValue.chainedAs.requireDPoP,
      };
    }

    // Use Partial<IssuanceDto> with explicit null for chainedAs since backend accepts null to clear it
    const issuanceDto = {
      batchSize: formValue.batchSize,
      display: formValue.display,
      dPopRequired: formValue.dPopRequired,
      refreshTokenEnabled: formValue.refreshTokenEnabled,
      refreshTokenExpiresInSeconds: formValue.refreshTokenEnabled
        ? formValue.refreshTokenExpiresInSeconds || 2592000
        : undefined,
      credentialResponseEncryption: formValue.credentialResponseEncryption ?? false,
      credentialRequestEncryption: formValue.credentialRequestEncryption ?? false,
      txCodeMaxAttempts: formValue.txCodeMaxAttempts ?? undefined,
      authServers: formValue.authServers?.length > 0 ? formValue.authServers : undefined,
      preferredAuthServer: formValue.preferredAuthServer || undefined,
      walletAttestationRequired: formValue.walletAttestationRequired,
      walletProviderTrustLists:
        formValue.walletProviderTrustLists?.length > 0
          ? formValue.walletProviderTrustLists
          : undefined,
      chainedAs: chainedAsConfig,
      federation: this.buildFederationConfig(formValue.federation),
    } as IssuanceDto;

    this.issuanceConfigService
      .saveConfiguration(issuanceDto)
      .then(
        () => {
          this.snackBar.open(`Configuration saved successfully`, 'Close', { duration: 3000 });
          this.router.navigate(['../'], { relativeTo: this.route });
        },
        (error: string) => {
          this.snackBar.open(`Failed to save configuration: ${error}`, 'Close', {
            duration: 3000,
          });
        }
      )
      .finally(() => {
        this.loading = false;
      });
  }

  private buildFederationConfig(federationFormValue: unknown): IssuanceDto['federation'] | null {
    if (!federationFormValue || typeof federationFormValue !== 'object') {
      return null;
    }
    const fVal = federationFormValue as Record<string, unknown>;
    const enabled = (fVal as any)['enabled'];
    const trustAnchors = (fVal as any)['trustAnchors'];
    if (!enabled || !Array.isArray(trustAnchors) || trustAnchors.length === 0) {
      return null;
    }
    const role = (fVal['role'] as string) ?? 'leaf';
    const mode = this.normalizeFederationMode(fVal['mode']);
    return {
      role: role as 'trust_anchor' | 'intermediate' | 'leaf',
      mode,
      entityId: (fVal['entityId'] as string) ?? undefined,
      enforceSigningPolicy: fVal['enforceSigningPolicy'] !== false,
      cacheTtlSeconds: (fVal['cacheTtlSeconds'] as number) ?? 300,
      trustAnchors: trustAnchors as {
        entityId: string;
        entityConfigurationUri: string;
      }[],
    };
  }

  getFormGroup(controlName: string): FormGroup {
    return this.form.get(controlName) as FormGroup;
  }

  getControl(value: any): FormControl {
    return value as FormControl;
  }

  get displays(): FormArray {
    return this.form.get('display') as FormArray;
  }

  addDisplay(): void {
    const displayGroup = this.fb.group({
      name: ['', Validators.required],
      locale: ['', Validators.required],
      logo: this.fb.group({
        uri: ['', Validators.required],
      }),
    });
    this.displays.push(displayGroup);
  }

  removeDisplay(index: number): void {
    this.displays.removeAt(index);
  }

  get authServers(): FormArray {
    return this.form.get('authServers') as FormArray;
  }

  addAuthServer(): void {
    this.authServers.push(new FormControl('', [Validators.required]));
  }

  removeAuthServer(index: number): void {
    this.authServers.removeAt(index);
  }

  get walletProviderTrustLists(): FormArray {
    return this.form.get('walletProviderTrustLists') as FormArray;
  }

  get chainedAs(): FormGroup {
    return this.form.get('chainedAs') as FormGroup;
  }

  get chainedAsEnabled(): boolean {
    return this.chainedAs.get('enabled')?.value ?? false;
  }

  get refreshTokenEnabled(): boolean {
    return this.form.get('refreshTokenEnabled')?.value ?? true;
  }

  get federation(): FormGroup {
    return this.form.get('federation') as FormGroup;
  }

  get federationEnabled(): boolean {
    return this.federation.get('enabled')?.value ?? false;
  }

  get trustAnchors(): FormArray {
    return this.federation.get('trustAnchors') as FormArray;
  }

  addTrustAnchor(): void {
    this.trustAnchors.push(
      this.fb.group({
        entityId: ['', Validators.required],
        entityConfigurationUri: ['', Validators.required],
      })
    );
  }

  removeTrustAnchor(index: number): void {
    this.trustAnchors.removeAt(index);
  }

  /**
   * Build the list of available authorization server options for the preferred AS dropdown.
   * Includes external auth servers, chained AS (if enabled), and the built-in AS.
   */
  get availableAuthServerOptions(): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = [];
    const servers = this.authServers.value as string[];
    for (const url of servers) {
      if (url) {
        options.push({ value: url, label: url });
      }
    }
    if (this.chainedAsEnabled) {
      options.push({ value: 'chained-as', label: 'Chained Authorization Server' });
    }
    options.push({ value: 'built-in', label: 'Built-in Authorization Server' });
    return options;
  }

  addWalletProviderTrustList(): void {
    this.walletProviderTrustLists.push(new FormControl('', [Validators.required]));
  }

  removeWalletProviderTrustList(index: number): void {
    this.walletProviderTrustLists.removeAt(index);
  }

  private markFormGroupTouched(): void {
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Open JSON view dialog to show/edit the complete configuration
   */
  viewAsJson(): void {
    const currentConfig = this.form.value;
    currentConfig.id = this.route.snapshot.params['id'];
    currentConfig.credentialConfigs = undefined;

    const dialogRef = this.dialog.open(JsonViewDialogComponent, {
      data: {
        title: 'Complete Configuration JSON',
        jsonData: currentConfig,
        readonly: false,
        schema: issuanceConfigSchema,
      },
      disableClose: true,
      minWidth: '60vw',
      maxWidth: '95vw',
      maxHeight: '95vh',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.form.patchValue(result);
      }
    });
  }
}
