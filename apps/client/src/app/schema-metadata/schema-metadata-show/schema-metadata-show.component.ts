import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import type {
  CredentialConfig,
  SchemaMetaConfig,
  UpdateSchemaMetadataDto,
  VocabularyEntryDto,
} from '@eudiplo/sdk-core';
import { CredentialConfigService } from '../../issuance/credential-config/credential-config.service';
import { SchemaMetadata, SchemaMetadataService } from '../schema-metadata.service';
import { getApiErrorMessage } from '../../utils/error-message';

const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

@Component({
  selector: 'app-schema-metadata-show',
  imports: [
    CommonModule,
    DatePipe,
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
  templateUrl: './schema-metadata-show.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './schema-metadata-show.component.scss',
})
export class SchemaMetadataShowComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly schemaMetadataService = inject(SchemaMetadataService);
  private readonly credentialConfigService = inject(CredentialConfigService);
  private readonly snackBar = inject(MatSnackBar);

  id = '';
  item?: SchemaMetadata;
  availableVersions: string[] = [];
  loading = false;
  showPublishForm = false;
  publishing = false;

  /** Predefined vocabulary entries for category selection */
  categoryVocabularies: VocabularyEntryDto[] = [];
  /** Predefined vocabulary entries for tag selection */
  tagVocabularies: VocabularyEntryDto[] = [];

  /** Credential configs that reference this schema metadata via schemaMeta.id */
  relatedCredentialConfigs: CredentialConfig[] = [];

  /**
   * For each trusted authority whose value is a local trust-list URL,
   * the extracted UUID — used to build the /trust-list/:id router link.
   */
  trustListIds: { value: string; localId: string | null }[] = [];

  metadataForm = new FormGroup({
    category: new FormControl(''),
    tags: new FormControl<string[]>([]),
  });

  publishForm = new FormGroup({
    newVersion: new FormControl('', [Validators.required, Validators.pattern(SEMVER_REGEX)]),
    rulebookURI: new FormControl(''),
    deprecateCurrent: new FormControl(true),
  });

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([paramMap, queryParams]) => {
        this.id = paramMap.get('id') || '';
        const version = queryParams.get('version') || undefined;
        void this.load(version);
      });
  }

  async load(version?: string): Promise<void> {
    if (!this.id) return;
    this.loading = true;
    try {
      const [latestItem, versions, vocabularies] = await Promise.all([
        this.schemaMetadataService.getById(this.id),
        this.schemaMetadataService.getVersions(this.id),
        this.schemaMetadataService.getVocabularies(),
      ]);

      this.categoryVocabularies = Array.isArray(vocabularies?.categories)
        ? vocabularies.categories
        : [];
      this.tagVocabularies = Array.isArray(vocabularies?.tags) ? vocabularies.tags : [];

      this.availableVersions = versions
        .map((entry) => entry.version)
        .sort((a, b) => this.compareSemverDesc(a, b));

      const selectedVersion = version?.trim();
      if (selectedVersion) {
        const selectedItems = await this.schemaMetadataService.list({
          attestationId: this.id,
          version: selectedVersion,
        });
        this.item = selectedItems[0] ?? latestItem;
      } else {
        this.item = latestItem;
      }

      if (selectedVersion && this.item.version !== selectedVersion) {
        this.snackBar.open(
          `Version ${selectedVersion} not found. Showing version ${this.item.version} instead.`,
          'Close',
          { duration: 4000 }
        );
      }

      this.metadataForm.patchValue({
        category: this.item.category || '',
        tags: (this.item.tags ?? []) as string[],
      });
      this.publishForm.patchValue({
        newVersion: this.bumpMinorVersion(this.item.version),
        rulebookURI: this.item.rulebookURI || '',
      });
      // Map trusted authority values to local trust-list IDs (last URL segment)
      this.trustListIds = (this.item.trustedAuthorities ?? []).map((ta) => ({
        value: ta.value,
        localId: this.extractTrustListId(ta.value),
      }));
      const allConfigs = await this.credentialConfigService.loadConfigurations();
      this.relatedCredentialConfigs = allConfigs.filter((c) => {
        const schemaMetaId = (c.schemaMeta as SchemaMetaConfig | undefined)?.id;
        const schemaMetaIdMatches =
          !!schemaMetaId &&
          (schemaMetaId === this.item!.id || schemaMetaId.split('/').pop() === this.item!.id);

        // Fallback for entries where schemaMeta.id was not written back:
        // infer relation via schema URI path segment /schema/{credentialConfigId}/{format}.
        const schemaUriMatches = (this.item?.schemaURIs ?? []).some(
          (entry) => typeof entry.uri === 'string' && entry.uri.includes(`/schema/${c.id}/`)
        );

        return schemaMetaIdMatches || schemaUriMatches;
      });
    } catch (error) {
      console.error('Failed to load schema metadata:', error);
      this.snackBar.open('Failed to load schema metadata', 'Close', { duration: 3000 });
      this.router.navigate(['/schema-metadata']);
    } finally {
      this.loading = false;
    }
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

  async saveMetadata(): Promise<void> {
    if (!this.id) return;
    try {
      const tags = (this.metadataForm.get('tags')?.value ?? []) as UpdateSchemaMetadataDto['tags'];

      this.item = await this.schemaMetadataService.updateMetadata(
        this.id,
        this.item?.version ?? '',
        {
          category:
            (this.metadataForm.get('category')?.value as
              | UpdateSchemaMetadataDto['category']
              | undefined) || undefined,
          tags,
        }
      );

      this.snackBar.open('Metadata updated', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to update metadata:', error);
      this.snackBar.open('Failed to update metadata', 'Close', { duration: 3000 });
    }
  }

  async copyJwt(): Promise<void> {
    if (!this.id) return;
    try {
      const jwt = await this.schemaMetadataService.getSignedJwt(this.id, this.item?.version ?? '');
      await navigator.clipboard.writeText(jwt);
      this.snackBar.open('Signed JWT copied to clipboard', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to copy JWT:', error);
      this.snackBar.open('Failed to copy JWT', 'Close', { duration: 3000 });
    }
  }

  get jwtUrl(): string {
    const version = this.item?.version;
    const idUrl = this.extractCatalogIdFromSignedJwt(this.item?.signedJwt);
    if (!idUrl || !version) return '';

    // If the ID already points to a versioned JWT endpoint, keep it as-is.
    if (/\/versions\/[^/]+\/jwt$/.test(idUrl)) {
      return idUrl;
    }

    return `${idUrl}/versions/${version}/jwt`;
  }

  private extractCatalogIdFromSignedJwt(jwt?: string): string | null {
    if (!jwt) return null;
    try {
      const parts = jwt.split('.');
      if (parts.length < 2) return null;

      const payloadBase64 = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      const padded = payloadBase64.padEnd(
        payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4),
        '='
      );
      const payloadJson = atob(padded);
      const payload = JSON.parse(payloadJson) as { id?: unknown };
      const idUrl = typeof payload.id === 'string' ? payload.id.replace(/\/$/, '') : '';
      return idUrl || null;
    } catch {
      return null;
    }
  }

  async copyJwtUrl(): Promise<void> {
    if (!this.jwtUrl) return;
    try {
      await navigator.clipboard.writeText(this.jwtUrl);
      this.snackBar.open('JWT URL copied to clipboard', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Failed to copy JWT URL:', error);
      this.snackBar.open('Failed to copy JWT URL', 'Close', { duration: 3000 });
    }
  }

  async downloadExport(): Promise<void> {
    if (!this.id) return;
    try {
      const exported = await this.schemaMetadataService.exportCatalog(
        this.id,
        this.item?.version ?? ''
      );
      const data = JSON.stringify(exported, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `schema-metadata-${this.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export schema metadata:', error);
      this.snackBar.open('Failed to export schema metadata', 'Close', { duration: 3000 });
    }
  }

  /** Increment the minor segment of a SemVer string and reset patch to 0. */
  private bumpMinorVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length === 3) {
      const minor = Number.parseInt(parts[1], 10);
      return `${parts[0]}.${minor + 1}.0`;
    }
    return version;
  }

  /**
   * Extract the UUID at the end of a trust-list URL
   * (e.g. http://host/issuers/tenant/trust-list/<uuid> → <uuid>).
   * Returns null if the value does not look like a local trust-list URL.
   */
  private extractTrustListId(value: string): string | null {
    try {
      const url = new URL(value);
      const segments = url.pathname.split('/').filter(Boolean);
      const idx = segments.indexOf('trust-list');
      if (idx !== -1 && segments[idx + 1]) {
        return segments[idx + 1];
      }
    } catch {
      // not a URL
    }
    return null;
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

  private findRelatedCredentialConfigForSchemaUri(uri?: string): CredentialConfig | undefined {
    if (!uri) {
      return undefined;
    }

    return this.relatedCredentialConfigs.find((cfg) => uri.includes(`/schema/${cfg.id}/`));
  }

  togglePublishForm(): void {
    this.showPublishForm = !this.showPublishForm;
  }

  async publishNewVersion(): Promise<void> {
    if (!this.item || this.publishForm.invalid) return;

    const newVersion = this.publishForm.get('newVersion')!.value!;
    const rulebookURI = this.publishForm.get('rulebookURI')!.value || this.item.rulebookURI;
    const deprecateCurrent = this.publishForm.get('deprecateCurrent')!.value;
    const catalogId = this.extractCatalogIdFromSignedJwt(this.item.signedJwt);

    if (!catalogId) {
      this.snackBar.open(
        'Cannot publish new version: invalid catalog ID in signed JWT payload',
        'Close',
        {
          duration: 4000,
        }
      );
      return;
    }

    const config: SchemaMetaConfig = {
      id: catalogId,
      version: newVersion,
      rulebookURI: rulebookURI ?? undefined,
      attestationLoS: this.item.attestationLoS,
      bindingType: this.item.bindingType,
      schemaURIs: (this.item.schemaURIs ?? []).map((s) => ({
        format: s.formatIdentifier,
        uri: s.uri,
        meta: this.deriveSchemaUriMetadata(
          (() => {
            const cfg = this.findRelatedCredentialConfigForSchemaUri(s.uri);
            if (!cfg) {
              throw new Error(
                `Unable to derive schemaURIs metadata for ${s.uri ?? 'unknown URI'}. ` +
                  'Ensure the schema is linked to a credential config in EUDIPLO.'
              );
            }
            return cfg;
          })()
        ),
      })),
      trustedAuthorities: (this.item.trustedAuthorities ?? []).map((t) => ({
        frameworkType: t.frameworkType,
        value: t.value,
      })),
    };

    this.publishing = true;
    try {
      const newEntry = await this.schemaMetadataService.publishNewVersion(config);

      if (deprecateCurrent) {
        await this.schemaMetadataService.deprecateVersion(this.item.id, this.item.version, {
          deprecated: true,
          message: `Superseded by version ${newVersion}`,
          supersededByVersion: newVersion,
        });
      }

      this.snackBar.open(`Version ${newVersion} published successfully`, 'Close', {
        duration: 4000,
      });
      this.showPublishForm = false;
      this.router.navigate(['/schema-metadata', newEntry.id], {
        queryParams: { version: newEntry.version },
      });
    } catch (error) {
      console.error('Failed to publish new version:', error);
      this.snackBar.open(getApiErrorMessage(error, 'Failed to publish new version'), 'Close', {
        duration: 6000,
      });
    } finally {
      this.publishing = false;
    }
  }

  async delete(): Promise<void> {
    try {
      await this.schemaMetadataService.delete(this.id, this.item?.version ?? '');
      this.snackBar.open('Schema metadata deleted', 'Close', { duration: 3000 });
      this.router.navigate(['/schema-metadata']);
    } catch (error) {
      console.error('Failed to delete schema metadata:', error);
      this.snackBar.open('Failed to delete schema metadata', 'Close', { duration: 3000 });
    }
  }

  async showVersion(version: string): Promise<void> {
    if (!version || this.item?.version === version) return;

    await this.router.navigate(['/schema-metadata', this.id], {
      queryParams: { version },
    });
  }

  private compareSemverDesc(a: string, b: string): number {
    const aParts = a.split('.').map((part) => Number.parseInt(part, 10));
    const bParts = b.split('.').map((part) => Number.parseInt(part, 10));
    const maxLen = Math.max(aParts.length, bParts.length);

    for (let index = 0; index < maxLen; index += 1) {
      const aValue = Number.isNaN(aParts[index]) ? 0 : (aParts[index] ?? 0);
      const bValue = Number.isNaN(bParts[index]) ? 0 : (bParts[index] ?? 0);
      if (aValue !== bValue) {
        return bValue - aValue;
      }
    }

    return 0;
  }
}
