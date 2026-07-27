import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormBuilder,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
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
import { IssuanceConfig, UpdateIssuanceDto } from '@eudiplo/sdk-core';
import { IssuanceConfigService } from '../issuance-config.service';
import { issuanceConfigSchema } from '../../../utils/schemas';
import { JsonViewDialogComponent } from '../../credential-config/credential-config-create/json-view-dialog/json-view-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ImageFieldComponent } from '../../../utils/image-field/image-field.component';
import { MatCardModule } from '@angular/material/card';
import { PresentationManagementService } from '../../../presentation/presentation-config/presentation-management.service';
import { RegistrarService } from '../../../registrar/registrar.service';

@Component({
  selector: 'app-issuance-config-create',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './issuance-config-create.component.scss',
})
export class IssuanceConfigCreateComponent implements OnInit {
  private trustListVerifierValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value as {
      verifierKey?: unknown;
      verifierX509Der?: unknown;
    };

    const hasVerifierKey =
      !!value?.verifierKey && typeof value.verifierKey === 'string' && value.verifierKey.trim();
    const hasVerifierX509Der =
      !!value?.verifierX509Der &&
      typeof value.verifierX509Der === 'string' &&
      value.verifierX509Der.trim();

    return hasVerifierKey || hasVerifierX509Der ? null : { missingVerifier: true };
  }

  private createWalletProviderTrustListGroup(value?: {
    url?: string;
    verifierKey?: string;
    verifierX509Der?: string;
  }): FormGroup {
    return this.fb.group(
      {
        url: [value?.url ?? '', [Validators.required]],
        verifierKey: [value?.verifierKey ?? ''],
        verifierX509Der: [value?.verifierX509Der ?? ''],
      },
      {
        validators: [this.trustListVerifierValidator.bind(this)],
      }
    );
  }

  public form: FormGroup;
  public loading = false;
  public availablePresentationConfigIds: string[] = [];
  private readonly federationModes = ['federation-only', 'hybrid'] as const;
  private registrarRegistrationCertificateDefaults: Record<string, unknown> | null = null;

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
    private readonly fb: FormBuilder,
    private readonly presentationManagementService: PresentationManagementService,
    private readonly registrarService: RegistrarService
  ) {
    this.form = new FormGroup({
      display: this.fb.array([]),
      authorizationServers: this.fb.array([]),
      batchSize: new FormControl(1, [Validators.min(1)]),
      dPopRequired: new FormControl(false),
      txCodeMaxAttempts: new FormControl<number | null>(null, [Validators.min(1)]),
      credentialResponseEncryption: new FormControl(false),
      credentialRequestEncryption: new FormControl(false),
      walletAttestationRequired: new FormControl(false),
      walletProviderTrustLists: this.fb.array([]),
      federation: this.fb.group({
        enabled: [false],
        role: ['leaf'],
        mode: ['hybrid'],
        entityId: [''],
        enforceSigningPolicy: [true],
        cacheTtlSeconds: [300],
        trustAnchors: this.fb.array([]),
      }),
      registrationCertificate: this.fb.group({
        enabled: [false],
        mode: ['generate'],
        jwt: [''],
        privacyPolicy: [''],
        supportUri: [''],
      }),
    } as { [k in keyof IssuanceConfig]: any });
  }

  ngOnInit(): void {
    // Defer network/config hydration so tab navigation is interactive immediately.
    setTimeout(() => {
      this.loadPresentationConfigs();
      void this.loadConfigForEdit();
      void this.loadRegistrarDefaults();
    }, 0);
  }

  private async loadRegistrarDefaults(): Promise<void> {
    try {
      const config = await this.registrarService.getConfig();
      const defaults = config?.registrationCertificateDefaults;
      if (!defaults || typeof defaults !== 'object') {
        this.registrarRegistrationCertificateDefaults = null;
        return;
      }

      this.registrarRegistrationCertificateDefaults = defaults as Record<string, unknown>;
      this.applyRegistrationCertificateDefaultsIfMissing(defaults as Record<string, unknown>);
    } catch {
      // Keep form editable even if registrar settings are unavailable.
    }
  }

  async applyRegistrarDefaultsFromRegistrar(): Promise<void> {
    try {
      const config = await this.registrarService.getConfig();
      const defaults = config?.registrationCertificateDefaults;

      if (!defaults || typeof defaults !== 'object') {
        this.snackBar.open(
          'No registration certificate defaults configured in registrar',
          'Close',
          {
            duration: 3000,
          }
        );
        return;
      }

      this.registrarRegistrationCertificateDefaults = defaults as Record<string, unknown>;
      this.applyRegistrationCertificateDefaults(defaults as Record<string, unknown>, true);
      this.snackBar.open('Loaded privacy policy and support URI from registrar defaults', 'Close', {
        duration: 2500,
      });
    } catch {
      this.snackBar.open('Failed to load registrar defaults', 'Close', {
        duration: 3000,
      });
    }
  }

  private applyRegistrationCertificateDefaultsIfMissing(defaults: Record<string, unknown>): void {
    this.applyRegistrationCertificateDefaults(defaults, false);
  }

  private applyRegistrationCertificateDefaults(
    defaults: Record<string, unknown>,
    overwriteExisting: boolean
  ): void {
    const privacy =
      typeof defaults['privacy_policy'] === 'string' ? defaults['privacy_policy'].trim() : '';
    const support =
      typeof defaults['support_uri'] === 'string' ? defaults['support_uri'].trim() : '';

    const registrationCertificate = this.registrationCertificate;
    const privacyCtrl = registrationCertificate.get('privacyPolicy');
    const supportCtrl = registrationCertificate.get('supportUri');

    const currentPrivacy = `${privacyCtrl?.value ?? ''}`.trim();
    const currentSupport = `${supportCtrl?.value ?? ''}`.trim();

    if ((overwriteExisting || !currentPrivacy) && privacy) {
      privacyCtrl?.setValue(privacy);
    }
    if ((overwriteExisting || !currentSupport) && support) {
      supportCtrl?.setValue(support);
    }
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
        for (const [index, entry] of config.display.entries()) {
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

          if (index > 0 && index % 5 === 0) {
            await this.yieldToUi();
          }
        }
      }

      await this.yieldToUi();

      const authorizationServersArray = this.form.get('authorizationServers') as FormArray;
      authorizationServersArray.clear();
      if (
        (config as any).authorizationServers &&
        Array.isArray((config as any).authorizationServers)
      ) {
        const allServers = (config as any).authorizationServers;
        for (const [index, server] of allServers.entries()) {
          if (server?.type === 'external') {
            authorizationServersArray.push(
              this.createAuthorizationServerGroup({
                type: 'external',
                id: server.id ?? `external-${index + 1}`,
                issuer: server.issuer ?? '',
                label: server.label ?? server.issuer ?? '',
              })
            );
          } else if (server?.type === 'oid4vp' || server?.type === 'chained') {
            authorizationServersArray.push(
              this.createAuthorizationServerGroup({
                id: server.id ?? `${server.type || 'auth'}-${index + 1}`,
                label:
                  server.label ??
                  `${server.type === 'chained' ? 'Chained' : 'Hosted'} AS ${index + 1}`,
                type: server.type ?? 'oid4vp',
                enabled: server.enabled ?? true,
                requireDPoP: server.requireDPoP ?? false,
                oid4vp: {
                  presentationConfigId:
                    server.presentationConfigId ?? server.oid4vp?.presentationConfigId ?? '',
                  immediateWalletRedirect:
                    server.immediateWalletRedirect ??
                    server.oid4vp?.immediateWalletRedirect ??
                    true,
                },
                chained: {
                  issuer: server.upstream?.issuer ?? '',
                  clientId: server.upstream?.clientId ?? '',
                  clientSecret: server.upstream?.clientSecret ?? '',
                  scopes: server.upstream?.scopes ?? ['openid', 'profile', 'email'],
                },
                token: {
                  lifetimeSeconds: server.token?.lifetimeSeconds ?? 3600,
                  signingKeyId: server.token?.signingKeyId ?? '',
                  refreshTokenEnabled: server.token?.refreshTokenEnabled ?? true,
                  refreshTokenExpiresInSeconds:
                    server.token?.refreshTokenExpiresInSeconds ?? 2592000,
                },
              })
            );
          } else if (server?.type === 'built-in') {
            authorizationServersArray.push(
              this.createAuthorizationServerGroup({
                type: 'built-in',
                id: server.id ?? 'issuer-built-in',
                label: server.label ?? 'Built-in Authorization Server',
                enabled: server.enabled ?? true,
                requireDPoP: server.requireDPoP ?? false,
                token: {
                  lifetimeSeconds: server.token?.lifetimeSeconds ?? 3600,
                  signingKeyId: server.token?.signingKeyId ?? '',
                  refreshTokenEnabled: server.token?.refreshTokenEnabled ?? true,
                  refreshTokenExpiresInSeconds:
                    server.token?.refreshTokenExpiresInSeconds ?? 2592000,
                },
              })
            );
          }

          if (index > 0 && index % 5 === 0) {
            await this.yieldToUi();
          }
        }
      }

      await this.yieldToUi();

      // Load wallet provider trust lists
      const walletTrustListsArray = this.form.get('walletProviderTrustLists') as FormArray;
      walletTrustListsArray.clear();
      if (config.walletProviderTrustLists && Array.isArray(config.walletProviderTrustLists)) {
        for (const entry of config.walletProviderTrustLists as any[]) {
          if (typeof entry === 'string') {
            walletTrustListsArray.push(this.createWalletProviderTrustListGroup({ url: entry }));
            continue;
          }

          walletTrustListsArray.push(
            this.createWalletProviderTrustListGroup({
              url: entry?.url ?? '',
              verifierKey:
                entry?.verifierKey && typeof entry.verifierKey === 'object'
                  ? JSON.stringify(entry.verifierKey, null, 2)
                  : '',
              verifierX509Der:
                typeof entry?.verifierX509Der === 'string' ? entry.verifierX509Der : '',
            })
          );
        }
      }

      await this.yieldToUi();

      // Patch other form values
      const registrationCertificate = (config as any).registrationCertificate;
      this.form.patchValue({
        batchSize: config.batchSize,
        dPopRequired: config.dPopRequired,
        credentialResponseEncryption:
          (config as { credentialResponseEncryption?: boolean }).credentialResponseEncryption ??
          false,
        credentialRequestEncryption:
          (config as { credentialRequestEncryption?: boolean }).credentialRequestEncryption ??
          false,
        walletAttestationRequired: config.walletAttestationRequired ?? false,
        txCodeMaxAttempts: config.txCodeMaxAttempts ?? null,
        registrationCertificate: {
          enabled: registrationCertificate?.enabled ?? false,
          mode: registrationCertificate?.mode ?? 'generate',
          jwt: registrationCertificate?.jwt ?? '',
          privacyPolicy: registrationCertificate?.privacyPolicy ?? '',
          supportUri: registrationCertificate?.supportUri ?? '',
        },
      });

      // Load Federation config if present
      if (config && (config as any)['federation']) {
        const federation = (config as any)['federation'];
        this.trustAnchors.clear();
        if (federation.trustAnchors && Array.isArray(federation.trustAnchors)) {
          for (const [index, anchor] of federation.trustAnchors.entries()) {
            this.trustAnchors.push(
              this.fb.group({
                entityId: [anchor.entityId ?? '', Validators.required],
                entityConfigurationUri: [anchor.entityConfigurationUri ?? '', Validators.required],
              })
            );

            if (index > 0 && index % 5 === 0) {
              await this.yieldToUi();
            }
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

      await this.yieldToUi();

      if (this.registrarRegistrationCertificateDefaults) {
        this.applyRegistrationCertificateDefaultsIfMissing(
          this.registrarRegistrationCertificateDefaults
        );
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.snackBar.open('Failed to load configuration', 'Close', {
        duration: 3000,
      });
    }
  }

  private async yieldToUi(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  private loadPresentationConfigs(): void {
    this.presentationManagementService.loadConfigurations().then(
      (configs) => {
        this.availablePresentationConfigIds = (configs || [])
          .map((config) => config.id)
          .filter((id): id is string => !!id)
          .sort((a, b) => a.localeCompare(b));
      },
      (error) => {
        console.error('Failed to load presentation configs:', error);
      }
    );
  }

  private buildUnifiedAuthorizationServers(formValue: any): any[] {
    const authorizationServers = formValue.authorizationServers?.length
      ? formValue.authorizationServers
          .filter((server: any) => {
            if (server?.type === 'external') {
              return (
                typeof server?.id === 'string' &&
                server.id.trim().length > 0 &&
                typeof server?.issuer === 'string' &&
                server.issuer.trim().length > 0
              );
            }
            return typeof server?.id === 'string' && server.id.trim().length > 0;
          })
          .map((server: any) => {
            if (server.type === 'external') {
              const issuer = server.issuer.trim();
              return {
                id: server.id.trim(),
                type: 'external',
                issuer,
                label: server.label?.trim() || issuer,
              };
            }

            if (server.type === 'built-in') {
              return {
                id: server.id.trim(),
                type: 'built-in',
                label: server.label?.trim() || 'Built-in Authorization Server',
                enabled: server.enabled ?? true,
                requireDPoP: server.requireDPoP ?? false,
                token: {
                  lifetimeSeconds: server.token?.lifetimeSeconds || 3600,
                  signingKeyId: server.token?.signingKeyId || undefined,
                  refreshTokenEnabled: server.token?.refreshTokenEnabled ?? true,
                  refreshTokenExpiresInSeconds: server.token?.refreshTokenEnabled
                    ? server.token?.refreshTokenExpiresInSeconds || 2592000
                    : undefined,
                },
              };
            }

            const base = {
              id: server.id,
              label: server.label,
              type: server.type,
              enabled: server.enabled ?? true,
              requireDPoP: server.requireDPoP ?? false,
              token: {
                lifetimeSeconds: server.token?.lifetimeSeconds || 3600,
                signingKeyId: server.token?.signingKeyId || undefined,
                refreshTokenEnabled: server.token?.refreshTokenEnabled ?? true,
                refreshTokenExpiresInSeconds: server.token?.refreshTokenEnabled
                  ? server.token?.refreshTokenExpiresInSeconds || 2592000
                  : undefined,
              },
            } as Record<string, unknown>;

            if (server.type === 'chained') {
              return {
                ...base,
                upstream: {
                  issuer: server.chained?.issuer,
                  clientId: server.chained?.clientId,
                  clientSecret: server.chained?.clientSecret,
                  scopes: server.chained?.scopes,
                },
              };
            }

            return {
              ...base,
              presentationConfigId: server.oid4vp?.presentationConfigId,
              immediateWalletRedirect: server.oid4vp?.immediateWalletRedirect ?? true,
            };
          })
      : [];

    return authorizationServers;
  }

  private buildRegistrationCertificatePayload(registrationCertificateFormValue: any): any {
    if (!registrationCertificateFormValue?.enabled) {
      return undefined;
    }

    if (registrationCertificateFormValue.mode === 'import') {
      return {
        enabled: true,
        mode: 'import',
        jwt: registrationCertificateFormValue.jwt || undefined,
      };
    }

    return {
      enabled: true,
      mode: 'generate',
      privacyPolicy: registrationCertificateFormValue.privacyPolicy || undefined,
      supportUri: registrationCertificateFormValue.supportUri || undefined,
    };
  }

  onSubmit(): void {
    this.loading = true;
    const formValue = this.form.value;

    const unifiedAuthorizationServers = this.buildUnifiedAuthorizationServers(formValue);
    const registrationCertificate = this.buildRegistrationCertificatePayload(
      formValue.registrationCertificate
    );

    const issuanceDto: UpdateIssuanceDto = {
      batchSize: formValue.batchSize,
      display: formValue.display,
      dPopRequired: formValue.dPopRequired,
      credentialResponseEncryption: formValue.credentialResponseEncryption ?? false,
      credentialRequestEncryption: formValue.credentialRequestEncryption ?? false,
      txCodeMaxAttempts: formValue.txCodeMaxAttempts ?? undefined,
      authorizationServers:
        unifiedAuthorizationServers.length > 0 ? unifiedAuthorizationServers : [],
      walletAttestationRequired: formValue.walletAttestationRequired,
      walletProviderTrustLists:
        formValue.walletProviderTrustLists?.length > 0
          ? formValue.walletProviderTrustLists
              .map((entry: any) => {
                let verifierKey: Record<string, unknown> | undefined;
                if (typeof entry?.verifierKey === 'string' && entry.verifierKey.trim()) {
                  try {
                    verifierKey = JSON.parse(entry.verifierKey) as Record<string, unknown>;
                  } catch {
                    verifierKey = undefined;
                  }
                }

                return {
                  url: entry?.url?.trim() || undefined,
                  verifierKey,
                  verifierX509Der: entry?.verifierX509Der?.trim() || undefined,
                };
              })
              .filter(
                (entry: any) =>
                  !!entry.url && (entry.verifierKey !== undefined || !!entry.verifierX509Der)
              )
          : undefined,
      federation: this.buildFederationConfig(formValue.federation) ?? undefined,
      registrationCertificate,
    };

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

  private buildFederationConfig(federationFormValue: unknown): IssuanceConfig['federation'] | null {
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

  get authorizationServers(): FormArray {
    return this.form.get('authorizationServers') as FormArray;
  }

  private createAuthorizationServerGroup(value?: any): FormGroup {
    if (value?.type === 'external') {
      return this.fb.group({
        type: ['external', Validators.required],
        id: [value?.id ?? '', Validators.required],
        issuer: [value?.issuer ?? '', Validators.required],
        label: [value?.label ?? ''],
      });
    }

    if (value?.type === 'built-in') {
      return this.fb.group({
        type: ['built-in', Validators.required],
        id: [value?.id ?? 'issuer-built-in', Validators.required],
        label: [value?.label ?? 'Built-in Authorization Server', Validators.required],
        enabled: [value?.enabled ?? true],
        requireDPoP: [value?.requireDPoP ?? false],
        token: this.fb.group({
          lifetimeSeconds: [value?.token?.lifetimeSeconds ?? 3600, Validators.min(60)],
          signingKeyId: [value?.token?.signingKeyId ?? ''],
          refreshTokenEnabled: [value?.token?.refreshTokenEnabled ?? true],
          refreshTokenExpiresInSeconds: [
            value?.token?.refreshTokenExpiresInSeconds ?? 2592000,
            Validators.min(1),
          ],
        }),
      });
    }

    return this.fb.group({
      id: [value?.id ?? '', Validators.required],
      label: [value?.label ?? '', Validators.required],
      type: [value?.type ?? 'oid4vp', Validators.required],
      enabled: [value?.enabled ?? true],
      requireDPoP: [value?.requireDPoP ?? false],
      oid4vp: this.fb.group({
        presentationConfigId: [value?.oid4vp?.presentationConfigId ?? ''],
        immediateWalletRedirect: [value?.oid4vp?.immediateWalletRedirect ?? true],
      }),
      chained: this.fb.group({
        issuer: [value?.chained?.issuer ?? ''],
        clientId: [value?.chained?.clientId ?? ''],
        clientSecret: [value?.chained?.clientSecret ?? ''],
        scopes: [value?.chained?.scopes ?? ['openid', 'profile', 'email']],
      }),
      token: this.fb.group({
        lifetimeSeconds: [value?.token?.lifetimeSeconds ?? 3600, Validators.min(60)],
        signingKeyId: [value?.token?.signingKeyId ?? ''],
        refreshTokenEnabled: [value?.token?.refreshTokenEnabled ?? true],
        refreshTokenExpiresInSeconds: [
          value?.token?.refreshTokenExpiresInSeconds ?? 2592000,
          Validators.min(1),
        ],
      }),
    });
  }

  addExternalAuthorizationServer(): void {
    this.addAuthorizationServer();
  }

  addAuthorizationServer(): void {
    this.authorizationServers.push(this.createAuthorizationServerGroup());
  }

  addChainedAuthorizationServer(): void {
    this.addAuthorizationServer();
  }

  addBuiltInAuthorizationServer(): void {
    this.addAuthorizationServer();
  }

  onAuthorizationServerTypeChange(
    index: number,
    type: 'external' | 'oid4vp' | 'chained' | 'built-in'
  ): void {
    const current = this.authorizationServers.at(index)?.value;
    if (!current) {
      return;
    }

    if (type === 'built-in' && this.hasBuiltInAuthorizationServer(index)) {
      this.snackBar.open('Only one built-in authorization server can be configured', 'Close', {
        duration: 3000,
      });
      this.authorizationServers.at(index).get('type')?.setValue('oid4vp', { emitEvent: false });
      type = 'oid4vp';
    }

    const nextValue: any = {
      ...current,
      type,
    };

    if (type === 'external') {
      nextValue.issuer = current.issuer ?? '';
      nextValue.label = current.label ?? '';
    }

    if (type === 'chained' && !nextValue.label) {
      nextValue.label = 'Chained Authorization Server';
    }

    if (type === 'built-in' && !nextValue.label) {
      nextValue.label = 'Built-in Authorization Server';
    }

    this.authorizationServers.setControl(index, this.createAuthorizationServerGroup(nextValue));
  }

  hasBuiltInAuthorizationServer(excludeIndex?: number): boolean {
    return this.authorizationServers.controls.some((control, index) => {
      if (excludeIndex !== undefined && index === excludeIndex) {
        return false;
      }
      return control.get('type')?.value === 'built-in';
    });
  }

  removeAuthorizationServer(index: number): void {
    this.authorizationServers.removeAt(index);
  }

  moveAuthorizationServer(index: number, direction: 'up' | 'down'): void {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.authorizationServers.length) {
      return;
    }

    const current = this.authorizationServers.at(index);
    const target = this.authorizationServers.at(targetIndex);
    this.authorizationServers.setControl(index, target);
    this.authorizationServers.setControl(targetIndex, current);
  }

  get walletProviderTrustLists(): FormArray {
    return this.form.get('walletProviderTrustLists') as FormArray;
  }

  get federation(): FormGroup {
    return this.form.get('federation') as FormGroup;
  }

  get registrationCertificate(): FormGroup {
    return this.form.get('registrationCertificate') as FormGroup;
  }

  get registrationCertificateEnabled(): boolean {
    return this.registrationCertificate.get('enabled')?.value ?? false;
  }

  get registrationCertificateMode(): 'import' | 'generate' {
    return this.registrationCertificate.get('mode')?.value ?? 'generate';
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

  addWalletProviderTrustList(): void {
    this.walletProviderTrustLists.push(this.createWalletProviderTrustListGroup());
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
    if (currentConfig.registrationCertificate?.enabled) {
      currentConfig.registrationCertificate = {
        enabled: true,
        mode: currentConfig.registrationCertificate.mode,
        jwt:
          currentConfig.registrationCertificate.mode === 'import'
            ? currentConfig.registrationCertificate.jwt || undefined
            : undefined,
        privacyPolicy:
          currentConfig.registrationCertificate.mode === 'generate'
            ? currentConfig.registrationCertificate.privacyPolicy || undefined
            : undefined,
        supportUri:
          currentConfig.registrationCertificate.mode === 'generate'
            ? currentConfig.registrationCertificate.supportUri || undefined
            : undefined,
      };
    } else {
      currentConfig.registrationCertificate = undefined;
    }

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
