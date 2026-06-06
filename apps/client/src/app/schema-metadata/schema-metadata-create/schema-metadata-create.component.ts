import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, isDevMode, ChangeDetectionStrategy } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  CredentialConfig,
  TrustList,
  type VocabularyEntryDto,
  trustListControllerGetAllTrustLists,
} from '@eudiplo/sdk-core';
import { CredentialConfigService } from '../../issuance/credential-config/credential-config.service';
import { SchemaMetadataService } from '../schema-metadata.service';

const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

@Component({
  selector: 'app-schema-metadata-create',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './schema-metadata-create.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './schema-metadata-create.component.scss',
})
export class SchemaMetadataCreateComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  readonly demoDefaultsEnabled = isDevMode();
  /** Credential config ID passed via query param — linked back to the schema metadata on submit */
  credentialConfigId: string | undefined;

  /** All credential configs (for importing schema URIs) */
  credentialConfigs: CredentialConfig[] = [];
  /** All trust lists (for importing trusted authorities) */
  trustLists: TrustList[] = [];
  /** Predefined vocabulary entries for category selection */
  categoryVocabularies: VocabularyEntryDto[] = [];
  /** Predefined vocabulary entries for tag selection */
  tagVocabularies: VocabularyEntryDto[] = [];

  readonly attestationLoSOptions = [
    { value: 'iso_18045_high', label: 'High (ISO 18045)' },
    { value: 'iso_18045_moderate', label: 'Moderate (ISO 18045)' },
    { value: 'iso_18045_enhanced-basic', label: 'Enhanced Basic (ISO 18045)' },
    { value: 'iso_18045_basic', label: 'Basic (ISO 18045)' },
  ];

  readonly bindingTypeOptions = [
    { value: 'claim', label: 'Claim' },
    { value: 'key', label: 'Key' },
    { value: 'biometric', label: 'Biometric' },
    { value: 'none', label: 'None' },
  ];

  readonly frameworkTypeOptions = [
    { value: 'etsi_tl', label: 'ETSI TL' },
    { value: 'openid_federation', label: 'OpenID Federation' },
  ];

  readonly schemaFormatOptions = [
    { value: 'dc+sd-jwt', label: 'dc+sd-jwt' },
    { value: 'mso_mdoc', label: 'mso_mdoc' },
  ];

  /** The main schema metadata composition form */
  composeForm = new FormGroup({
    version: new FormControl('', [Validators.required, Validators.pattern(SEMVER_REGEX)]),
    rulebookURI: new FormControl('', [Validators.required]),
    attestationLoS: new FormControl('', [Validators.required]),
    bindingType: new FormControl('', [Validators.required]),
    category: new FormControl(''),
    tags: new FormControl<string[]>([]),
    schemaURIs: new FormArray<FormGroup>([], Validators.required),
    trustedAuthorities: new FormArray<FormGroup>([], Validators.required),
  });

  /** For selecting a config whose schemaURIs to import */
  importSchemaConfigIds = new FormControl<string[]>([]);
  /** For selecting trust lists to include as trusted authorities */
  importTrustListIds = new FormControl<string[]>([]);

  constructor(
    private readonly fb: FormBuilder,
    private readonly schemaMetadataService: SchemaMetadataService,
    private readonly credentialConfigService: CredentialConfigService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.credentialConfigId =
      this.route.snapshot.queryParamMap.get('credentialConfigId') ?? undefined;
    this.loadData();
    if (this.demoDefaultsEnabled) {
      this.applyDemoValues();
    }
  }

  applyDemoValues(): void {
    this.composeForm.patchValue({
      version: '1.0.0',
      rulebookURI:
        'https://raw.githubusercontent.com/cre8/catalog-of-attestations/refs/heads/main/rulebooks/gym-membership-card/1.0.0.md',
      attestationLoS: 'iso_18045_basic',
      bindingType: 'key',
    });

    // schemaURIs are imported from credential configs only.
    this.schemaURIs.clear();
    this.importSchemaConfigIds.setValue([]);

    this.trustedAuthorities.clear();
    this.importTrustListIds.setValue([]);
  }

  get schemaURIs(): FormArray<FormGroup> {
    return this.composeForm.get('schemaURIs') as FormArray<FormGroup>;
  }

  get trustedAuthorities(): FormArray<FormGroup> {
    return this.composeForm.get('trustedAuthorities') as FormArray<FormGroup>;
  }

  /** Display label for a credential config (used in select dropdown). */
  configLabel(c: CredentialConfig): string {
    return c.description ? `${c.description} (${c.id})` : c.id;
  }

  /** Display label for a trust list (used in select dropdown). */
  trustListLabel(tl: TrustList): string {
    return tl.description ? `${tl.description} (${tl.id})` : tl.id;
  }

  vocabularyLabel(entry: VocabularyEntryDto): string {
    if (entry.status === 'deprecated' && entry.replacedBy) {
      return `${entry.label} (${entry.code}) - deprecated, use ${entry.replacedBy}`;
    }
    if (entry.status === 'deprecated') {
      return `${entry.label} (${entry.code}) - deprecated`;
    }
    return `${entry.label} (${entry.code})`;
  }

  private createSchemaURIGroup(
    format = '',
    uri = '',
    imported = false,
    credentialConfigId = ''
  ): FormGroup {
    const group = this.fb.group({
      format: [format, Validators.required],
      uri: [uri, Validators.required],
      credentialConfigId: [credentialConfigId],
      imported: [imported],
    });
    if (imported) {
      group.get('format')!.disable();
      group.get('uri')!.disable();
    }
    return group;
  }

  private createTrustedAuthorityGroup(
    frameworkType = '',
    value = '',
    isLoTE = false,
    verificationMethod = '',
    imported = false
  ): FormGroup {
    const group = this.fb.group({
      frameworkType: [frameworkType, Validators.required],
      value: [value, Validators.required],
      isLoTE: [isLoTE],
      verificationMethod: [verificationMethod],
      imported: [imported],
    });
    if (imported) {
      group.get('frameworkType')!.disable();
      group.get('value')!.disable();
    }
    return group;
  }
  private createTrustListGroup(trustListId: string, label: string, isLoTE = true): FormGroup {
    return this.fb.group({
      trustListId: [trustListId],
      label: [label],
      isLoTE: [isLoTE],
      imported: [true],
    });
  }
  syncSchemaURIsFromSelection(): void {
    const selectedIds = this.importSchemaConfigIds.value ?? [];
    this.schemaURIs.clear();

    for (const id of selectedIds) {
      const config = this.credentialConfigs.find((c) => c.id === id);
      if (!config) continue;

      const format = config.config?.format ?? '';
      const uri = typeof config.vct === 'string' ? config.vct : (config.config?.docType ?? '');
      this.schemaURIs.push(this.createSchemaURIGroup(format, uri, true, id));
    }
  }

  private deriveSchemaUriMetadata(config: CredentialConfig): Record<string, unknown> {
    const format = config.config?.format;
    if (format === 'dc+sd-jwt') {
      const vct =
        typeof config.vct === 'string'
          ? config.vct
          : config.vct &&
              typeof config.vct === 'object' &&
              'vct' in config.vct &&
              typeof (config.vct as { vct?: unknown }).vct === 'string'
            ? (config.vct as { vct: string }).vct
            : undefined;

      if (!vct) {
        throw new Error(
          `Credential config ${config.id}: missing vct required for schemaURIs metadata`
        );
      }
      return { vct };
    }

    if (format === 'mso_mdoc') {
      const docType =
        config.config?.docType ||
        ((config.config as { doctype?: string } | undefined)?.doctype ?? undefined);

      if (!docType) {
        throw new Error(
          `Credential config ${config.id}: missing docType required for schemaURIs metadata`
        );
      }
      return { doctype_value: docType };
    }

    return {};
  }

  syncTrustedAuthoritiesFromSelection(): void {
    const selectedIds = this.importTrustListIds.value ?? [];

    const existingLoTE = new Map<string, boolean>();
    for (const group of this.trustedAuthorities.controls) {
      const trustListId = group.get('trustListId')?.value as string | undefined;
      const isLoTE = group.get('isLoTE')?.value as boolean | undefined;
      if (trustListId) {
        existingLoTE.set(trustListId, isLoTE ?? true);
      }
    }

    this.trustedAuthorities.clear();
    for (const id of selectedIds) {
      const tl = this.trustLists.find((t) => t.id === id);
      if (!tl) continue;

      const label = tl.description ? `${tl.description} (${tl.id})` : tl.id;
      const isLoTE = existingLoTE.get(id) ?? true;
      this.trustedAuthorities.push(this.createTrustListGroup(id, label, isLoTE));
    }
  }

  async loadData(): Promise<void> {
    try {
      const [configs, tlResponse, vocabularies] = await Promise.all([
        this.credentialConfigService.loadConfigurations(),
        trustListControllerGetAllTrustLists(),
        this.schemaMetadataService.getVocabularies(),
      ]);
      this.credentialConfigs = configs;
      this.trustLists = Array.isArray(tlResponse.data) ? tlResponse.data : [];
      this.categoryVocabularies = Array.isArray(vocabularies?.categories)
        ? vocabularies.categories
        : [];
      this.tagVocabularies = Array.isArray(vocabularies?.tags) ? vocabularies.tags : [];

      // Auto-select linked credential config when provided via query param.
      if (this.credentialConfigId && configs.some((c) => c.id === this.credentialConfigId)) {
        this.importSchemaConfigIds.setValue([this.credentialConfigId]);
      }

      this.syncSchemaURIsFromSelection();
      this.syncTrustedAuthoritiesFromSelection();
    } catch {
      // non-fatal — selects will simply be empty
    }
  }

  /**
   * Build the SchemaMetaConfig payload from the form. The attestation `id`
   * and all integrity hashes are intentionally omitted — they are produced
   * by the backend during signing (id from the registrar, integrity hashes
   * computed from the live URIs).
   */
  private buildConfig(): Record<string, unknown> {
    const raw = this.composeForm.getRawValue();

    // Trust list references use trustListId; manual entries use frameworkType + value.
    const trustedAuthorities = (raw.trustedAuthorities as Record<string, unknown>[]).map(
      (e: Record<string, unknown>, index: number) => {
        if (e['trustListId']) {
          return {
            trustListId: e['trustListId'],
            isLoTE: e['isLoTE'],
          };
        }

        const verificationMethodRaw = e['verificationMethod'];
        let verificationMethod: Record<string, unknown> | undefined;

        if (typeof verificationMethodRaw === 'string' && verificationMethodRaw.trim().length > 0) {
          try {
            const parsed = JSON.parse(verificationMethodRaw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              verificationMethod = parsed as Record<string, unknown>;
            } else {
              throw new Error('verificationMethod must be a JSON object');
            }
          } catch (error) {
            throw new Error(
              `Trusted authority #${index + 1}: verification method must be valid JSON object (${error instanceof Error ? error.message : 'invalid JSON'})`
            );
          }
        }

        return {
          frameworkType: e['frameworkType'],
          value: e['value'],
          ...(e['isLoTE'] !== undefined ? { isLoTE: e['isLoTE'] } : {}),
          ...(verificationMethod ? { verificationMethod } : {}),
        };
      }
    );

    return {
      version: raw.version!,
      rulebookURI: raw.rulebookURI!,
      attestationLoS: raw.attestationLoS,
      bindingType: raw.bindingType,
      ...(raw.category ? { category: raw.category } : {}),
      ...(Array.isArray(raw.tags) && raw.tags.length > 0 ? { tags: raw.tags } : {}),
      // Send credential config references so backend can resolve/upload schema sources reliably.
      schemaURIs: (raw.schemaURIs as Record<string, unknown>[]).map((e) => {
        if (typeof e['credentialConfigId'] === 'string' && e['credentialConfigId']) {
          const cfg = this.credentialConfigs.find((c) => c.id === e['credentialConfigId']);
          if (!cfg) {
            throw new Error(
              `Credential config ${String(e['credentialConfigId'])} not found for schemaURIs metadata`
            );
          }

          return {
            credentialConfigId: e['credentialConfigId'],
            metadata: this.deriveSchemaUriMetadata(cfg),
          };
        }

        const format = typeof e['format'] === 'string' ? e['format'] : undefined;
        throw new Error(
          `Schema URI metadata is required. Unable to derive metadata for manual schema entry${
            format ? ` (format: ${format})` : ''
          }.`
        );
      }),
      trustedAuthorities,
    };
  }

  async submit(): Promise<void> {
    if (this.composeForm.invalid) {
      this.composeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    try {
      // The backend reserves the attestation id, signs the config and submits
      // it to the registrar in a single call — we just receive the resulting
      // metadata entry.
      const created = await this.schemaMetadataService.signSchemaMetaConfig(
        this.buildConfig() as never,
        undefined,
        this.credentialConfigId
      );

      this.snackBar.open('Schema metadata submitted', 'Close', { duration: 3000 });
      this.router.navigate(['/schema-metadata', created.id]);
    } catch (error) {
      console.error('Failed to submit schema metadata:', error);
      const msg = error instanceof Error ? error.message : 'Failed to submit schema metadata';
      this.snackBar.open(msg, 'Close', { duration: 5000 });
    } finally {
      this.loading = false;
    }
  }
}
