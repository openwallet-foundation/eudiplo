import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormBuilder,
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
import { IssuanceDto, type SchemaMetadataResponseDto } from '@eudiplo/sdk-core';
import { IssuanceConfigService } from '../issuance-config.service';
import { issuanceConfigSchema } from '../../../utils/schemas';
import { JsonViewDialogComponent } from '../../credential-config/credential-config-create/json-view-dialog/json-view-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ImageFieldComponent } from '../../../utils/image-field/image-field.component';
import { MatCardModule } from '@angular/material/card';
import { PresentationManagementService } from '../../../presentation/presentation-config/presentation-management.service';

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
  public form: FormGroup;
  public loading = false;
  public availablePresentationConfigIds: string[] = [];
  public availableSchemaMetadata: SchemaMetadataResponseDto[] = [];
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
    private readonly fb: FormBuilder,
    private readonly presentationManagementService: PresentationManagementService
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
        mode: ['import'],
        jwt: [''],
        schemaMetadataIds: [[]],
        privacyPolicy: [''],
        supportUri: [''],
      }),
    } as { [k in keyof IssuanceDto]: any });
  }

  ngOnInit(): void {
    // Defer network/config hydration so tab navigation is interactive immediately.
    setTimeout(() => {
      this.loadPresentationConfigs();
      this.loadSchemaMetadata();
      void this.loadConfigForEdit();
    }, 0);
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
        for (const url of config.walletProviderTrustLists) {
          walletTrustListsArray.push(new FormControl(url, [Validators.required]));
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
          mode: registrationCertificate?.mode ?? 'import',
          jwt: registrationCertificate?.jwt ?? '',
          schemaMetadataIds: registrationCertificate?.schemaMetadataIds ?? [],
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

  private loadSchemaMetadata(): void {
    this.issuanceConfigService.getSchemaMetadata().then(
      (schemas) => {
        this.availableSchemaMetadata = [...(schemas || [])].sort((a, b) =>
          `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`)
        );
      },
      (error) => {
        console.error('Failed to load schema metadata:', error);
      }
    );
  }

  private buildUnifiedAuthorizationServers(formValue: any): any[] {
    const authorizationServers = formValue.authorizationServers?.length
      ? formValue.authorizationServers
          .filter((server: any) => {
            if (server?.type === 'external') {
              return typeof server?.issuer === 'string' && server.issuer.trim().length > 0;
            }
            if (server?.type === 'built-in') {
              return true;
            }
            return typeof server?.id === 'string' && server.id.trim().length > 0;
          })
          .map((server: any) => {
            if (server.type === 'external') {
              const issuer = server.issuer.trim();
              return {
                type: 'external',
                issuer,
                label: server.label?.trim() || issuer,
              };
            }

            if (server.type === 'built-in') {
              return {
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

  private buildRegistrationCertificatePayload(
    registrationCertificateFormValue: any,
    providedAttestations: any[]
  ): any {
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
      schemaMetadataIds: registrationCertificateFormValue.schemaMetadataIds?.length
        ? registrationCertificateFormValue.schemaMetadataIds
        : undefined,
      providedAttestations,
      privacyPolicy: registrationCertificateFormValue.privacyPolicy || undefined,
      supportUri: registrationCertificateFormValue.supportUri || undefined,
    };
  }

  private findSchemaMetadataBySelection(selection: string): SchemaMetadataResponseDto | undefined {
    const [id, version] = String(selection).split('@');
    return this.availableSchemaMetadata.find(
      (entry) => entry.id === id && entry.version === version
    );
  }

  private buildAttestationsFromSchemaMetadata(metadata: SchemaMetadataResponseDto): any[] {
    const schemaUris = Array.isArray(metadata.schemaURIs) ? metadata.schemaURIs : [];
    if (schemaUris.length > 0) {
      return schemaUris.map((schema) => ({
        format: schema.formatIdentifier,
        meta: {
          schema_metadata_id: metadata.id,
          schema_metadata_version: metadata.version,
          schema_uri: schema.uri,
          schema_entry_id: schema.id,
        },
      }));
    }

    return (metadata.supportedFormats || []).map((format) => ({
      format,
      meta: {
        schema_metadata_id: metadata.id,
        schema_metadata_version: metadata.version,
      },
    }));
  }

  private buildProvidedAttestationsFromSchemaSelection(
    registrationCertificate: any
  ): { ok: true; value: any[] } | { ok: false; error: string } {
    if (!registrationCertificate?.enabled || registrationCertificate.mode !== 'generate') {
      return { ok: true, value: [] };
    }

    const selected = Array.isArray(registrationCertificate.schemaMetadataIds)
      ? registrationCertificate.schemaMetadataIds
      : [];

    if (selected.length === 0) {
      return {
        ok: false,
        error: 'Select at least one schema metadata entry in generate mode.',
      };
    }

    const missingSelection = selected.find(
      (selection: string) => !this.findSchemaMetadataBySelection(String(selection))
    );
    if (missingSelection) {
      return {
        ok: false,
        error: `Selected schema metadata ${missingSelection} is no longer available.`,
      };
    }

    const providedAttestations = selected.flatMap((selection: string) =>
      this.buildAttestationsFromSchemaMetadata(
        this.findSchemaMetadataBySelection(String(selection)) as SchemaMetadataResponseDto
      )
    );

    if (providedAttestations.length === 0) {
      return {
        ok: false,
        error: 'No attestations could be derived from selected schema metadata entries.',
      };
    }

    return { ok: true, value: providedAttestations };
  }

  onSubmit(): void {
    this.loading = true;
    const formValue = this.form.value;

    const parseResult = this.buildProvidedAttestationsFromSchemaSelection(
      formValue.registrationCertificate
    );
    if (!parseResult.ok) {
      this.snackBar.open(parseResult.error, 'Close', {
        duration: 4000,
      });
      this.loading = false;
      return;
    }

    const unifiedAuthorizationServers = this.buildUnifiedAuthorizationServers(formValue);
    const registrationCertificate = this.buildRegistrationCertificatePayload(
      formValue.registrationCertificate,
      parseResult.value
    );

    const issuanceDto = {
      batchSize: formValue.batchSize,
      display: formValue.display,
      dPopRequired: formValue.dPopRequired,
      credentialResponseEncryption: formValue.credentialResponseEncryption ?? false,
      credentialRequestEncryption: formValue.credentialRequestEncryption ?? false,
      txCodeMaxAttempts: formValue.txCodeMaxAttempts ?? undefined,
      authorizationServers:
        unifiedAuthorizationServers.length > 0 ? unifiedAuthorizationServers : undefined,
      walletAttestationRequired: formValue.walletAttestationRequired,
      walletProviderTrustLists:
        formValue.walletProviderTrustLists?.length > 0
          ? formValue.walletProviderTrustLists
          : undefined,
      federation: this.buildFederationConfig(formValue.federation),
      registrationCertificate,
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

  get authorizationServers(): FormArray {
    return this.form.get('authorizationServers') as FormArray;
  }

  private createAuthorizationServerGroup(value?: any): FormGroup {
    if (value?.type === 'external') {
      return this.fb.group({
        type: ['external', Validators.required],
        issuer: [value?.issuer ?? '', Validators.required],
        label: [value?.label ?? ''],
      });
    }

    if (value?.type === 'built-in') {
      return this.fb.group({
        type: ['built-in', Validators.required],
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
    if (!current || current.type === type) {
      return;
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
    return this.registrationCertificate.get('mode')?.value ?? 'import';
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
    const parseResult = this.buildProvidedAttestationsFromSchemaSelection(
      currentConfig.registrationCertificate
    );
    if (!parseResult.ok) {
      this.snackBar.open(parseResult.error, 'Close', {
        duration: 4000,
      });
      return;
    }

    if (currentConfig.registrationCertificate?.enabled) {
      currentConfig.registrationCertificate = {
        enabled: true,
        mode: currentConfig.registrationCertificate.mode,
        jwt:
          currentConfig.registrationCertificate.mode === 'import'
            ? currentConfig.registrationCertificate.jwt || undefined
            : undefined,
        schemaMetadataIds:
          currentConfig.registrationCertificate.mode === 'generate' &&
          currentConfig.registrationCertificate.schemaMetadataIds?.length
            ? currentConfig.registrationCertificate.schemaMetadataIds
            : undefined,
        providedAttestations:
          currentConfig.registrationCertificate.mode === 'generate' ? parseResult.value : undefined,
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
