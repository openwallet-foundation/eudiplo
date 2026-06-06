import { Component, type OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { CredentialConfig, deriveRuntimeArtifacts } from '@eudiplo/sdk-core';
import { CredentialConfigService } from '../credential-config.service';
import { StatusListManagementService } from '../../../status-list-management/status-list-management.service';
import { downloadJsonFile } from '../../../common/download-json.util';

interface ClaimFieldRow {
  key: string;
  hasDefaultValue: boolean;
  defaultValue?: unknown;
  disclosableLabel: 'Yes' | 'No' | 'N/A' | 'Not configured';
  mandatory: boolean | null;
  typeLabel: string | null;
  displayLabels: string[];
}

interface SchemaPathInfo {
  required: Set<string>;
  known: Set<string>;
  types: Map<string, string>;
}

@Component({
  selector: 'app-credential-config-show',
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTooltipModule,
    MatExpansionModule,
    MatChipsModule,
    MatDividerModule,
    MatListModule,
    MatTabsModule,
    FlexLayoutModule,
    RouterModule,
    ClipboardModule,
  ],
  templateUrl: './credential-config-show.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './credential-config-show.component.scss',
})
export class CredentialConfigShowComponent implements OnInit {
  config: CredentialConfig | undefined;
  statusListId: string | undefined;

  constructor(
    private readonly credentialConfigService: CredentialConfigService,
    private readonly statusListService: StatusListManagementService,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly clipboard: Clipboard
  ) {}

  get isMdocFormat(): boolean {
    return this.config?.config?.format === 'mso_mdoc';
  }

  get isVctString(): boolean {
    return typeof this.config?.vct === 'string';
  }

  get vctAsString(): string | null {
    return typeof this.config?.vct === 'string' ? this.config.vct : null;
  }

  get vctAsObject(): any {
    return typeof this.config?.vct === 'object' ? this.config.vct : null;
  }

  get formatLabel(): string {
    if (this.config?.config?.format === 'mso_mdoc') {
      return 'mDOC (mso_mdoc)';
    }
    return 'SD-JWT VC (dc+sd-jwt)';
  }

  get primaryDisplay(): any {
    return this.config?.config?.display?.[0];
  }

  get fields(): Record<string, unknown>[] {
    const value = (this.config as any)?.fields;
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  }

  get runtimeArtifacts(): {
    claims: Record<string, unknown>;
    disclosureFrame?: Record<string, unknown>;
    claimsMetadata: Record<string, unknown>[];
    schema: Record<string, unknown>;
    claimsByNamespace: Record<string, Record<string, unknown>>;
  } {
    return deriveRuntimeArtifacts(this.fields as any) as any;
  }

  get claimsMetadataEntries(): Record<string, unknown>[] {
    if (this.fields.length > 0) {
      return this.runtimeArtifacts.claimsMetadata;
    }

    const value = (this.config?.config as any)?.claimsMetadata;
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  }

  get claimsByNamespaceValue(): Record<string, unknown> | null {
    if (this.fields.length > 0) {
      const value = this.runtimeArtifacts.claimsByNamespace;
      return Object.keys(value).length > 0 ? value : null;
    }

    const value = (this.config?.config as any)?.claimsByNamespace;
    return value && typeof value === 'object' ? value : null;
  }

  get schemaValue(): Record<string, unknown> | null {
    if (this.fields.length > 0) {
      return this.runtimeArtifacts.schema;
    }

    const value = (this.config as any)?.schema;
    return value && typeof value === 'object' ? value : null;
  }

  get defaultNamespaceValue(): string | null {
    const namespaces = this.claimsByNamespaceValue ? Object.keys(this.claimsByNamespaceValue) : [];
    if (namespaces.length === 1) {
      return namespaces[0];
    }
    return null;
  }

  get showJsonSchemaSection(): boolean {
    if (!this.schemaValue) {
      return false;
    }

    if (this.claimFieldRows.length === 0) {
      return true;
    }

    return !this.claimFieldRows.every((row) => this.isRowComplete(row));
  }

  copyToClipboard(value: string, label: string): void {
    this.clipboard.copy(value);
    this.snackBar.open(`${label} copied to clipboard`, 'Close', {
      duration: 2000,
    });
  }

  ngOnInit(): void {
    this.loadConfig();
  }

  private loadConfig(): void {
    const configId = this.route.snapshot.paramMap.get('id');
    if (configId) {
      this.credentialConfigService.getConfig(configId).then(
        (config) => {
          this.config = config;
          if (config.statusManagement) {
            this.loadStatusListId(config.id);
          }
        },
        (error) => {
          this.snackBar.open('Failed to load config', 'Close', {
            duration: 3000,
          });
          console.error('Load error:', error);
        }
      );
    }
  }

  private async loadStatusListId(credentialConfigId: string): Promise<void> {
    try {
      const lists = await this.statusListService.getLists();
      const match =
        lists.find((l) => l.credentialConfigurationId === credentialConfigId) ||
        lists.find((l) => !l.credentialConfigurationId);
      this.statusListId = match?.id;
    } catch (error) {
      console.error('Failed to load status list:', error);
    }
  }

  deleteConfig() {
    if (this.config && confirm('Are you sure you want to delete this configuration?')) {
      this.credentialConfigService
        .deleteConfiguration(this.config.id)
        .then(() => {
          this.snackBar.open('Configuration deleted successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['../'], { relativeTo: this.route });
        })
        .catch((error) => {
          this.snackBar.open('Failed to delete configuration', 'Close', {
            duration: 3000,
          });
          console.error('Delete error:', error);
        });
    }
  }

  formatLifetime(seconds?: number | null): string {
    if (!seconds) return 'Not set';

    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  formatJsonValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  }

  get claimFieldRows(): ClaimFieldRow[] {
    if (!this.config) {
      return [];
    }

    if (this.fields.length > 0) {
      return this.fields
        .filter((field) => Array.isArray(field['path']) && field['path'].length > 0)
        .map((field) => {
          const path = field['path'] as (string | number | null)[];
          const key = this.pathToKey(path);
          const hasDefaultValue = Object.prototype.hasOwnProperty.call(field, 'defaultValue');
          const display = Array.isArray(field['display'])
            ? (field['display'] as Record<string, unknown>[])
            : [];

          return {
            key,
            hasDefaultValue,
            defaultValue: hasDefaultValue ? field['defaultValue'] : undefined,
            disclosableLabel: this.isMdocFormat
              ? 'N/A'
              : field['disclosable'] === true
                ? 'Yes'
                : field['disclosable'] === false
                  ? 'No'
                  : 'Not configured',
            mandatory:
              typeof field['mandatory'] === 'boolean' ? (field['mandatory'] as boolean) : null,
            typeLabel: typeof field['type'] === 'string' ? (field['type'] as string) : null,
            displayLabels: display
              .map((entry) => {
                const lang =
                  typeof entry['lang'] === 'string' ? (entry['lang'] as string) : 'default';
                const label =
                  typeof entry['label'] === 'string' ? (entry['label'] as string) : null;
                return label ? `${lang}: ${label}` : null;
              })
              .filter((value): value is string => value !== null),
          } as ClaimFieldRow;
        })
        .sort((a, b) => a.key.localeCompare(b.key));
    }

    const defaults = new Map<string, unknown>();
    for (const item of this.flattenObjectLeaves((this.config as any).claims)) {
      defaults.set(this.pathToKey(item.path), item.value);
    }

    const disclosurePaths = this.collectDisclosurePaths((this.config as any).disclosureFrame);
    const hasDisclosureConfig = disclosurePaths.size > 0;
    const schemaPathInfo = this.collectSchemaPathInfo((this.config as any).schema);

    const rows = new Map<string, ClaimFieldRow>();
    const metadataClaims = this.claimsMetadataEntries;

    for (const claim of metadataClaims) {
      const path = Array.isArray(claim['path']) ? claim['path'] : [];
      const key = this.pathToKey(path);
      const defaultValue = defaults.get(key);
      const disclosableFromMetadata =
        typeof claim['disclosable'] === 'boolean' ? claim['disclosable'] : undefined;

      const schemaType = schemaPathInfo.types.get(key) ?? null;
      rows.set(key, {
        key,
        hasDefaultValue: defaults.has(key),
        defaultValue,
        disclosableLabel: this.resolveDisclosableLabel(
          key,
          hasDisclosureConfig,
          disclosurePaths,
          disclosableFromMetadata
        ),
        mandatory: this.resolveMandatory(
          key,
          typeof claim['mandatory'] === 'boolean' ? claim['mandatory'] : undefined,
          schemaPathInfo
        ),
        typeLabel:
          typeof claim['type'] === 'string'
            ? claim['type']
            : typeof claim['valueType'] === 'string'
              ? claim['valueType']
              : typeof claim['value_type'] === 'string'
                ? claim['value_type']
                : schemaType,
        displayLabels: this.getDisplayLabels(claim['display']),
      });
    }

    for (const [key, defaultValue] of defaults.entries()) {
      if (rows.has(key)) {
        continue;
      }
      const schemaType = schemaPathInfo.types.get(key) ?? null;
      rows.set(key, {
        key,
        hasDefaultValue: true,
        defaultValue,
        disclosableLabel: this.resolveDisclosableLabel(
          key,
          hasDisclosureConfig,
          disclosurePaths,
          undefined
        ),
        mandatory: this.resolveMandatory(key, undefined, schemaPathInfo),
        typeLabel: schemaType ?? this.inferTypeFromValue(defaultValue),
        displayLabels: [],
      });
    }

    return Array.from(rows.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  private getDisplayLabels(display: unknown): string[] {
    if (!Array.isArray(display)) {
      return [];
    }

    return display
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const locale =
          typeof record['locale'] === 'string' ? (record['locale'] as string) : 'default';
        const name = typeof record['name'] === 'string' ? (record['name'] as string) : null;

        return name ? `${locale}: ${name}` : null;
      })
      .filter((value): value is string => value !== null);
  }

  private resolveDisclosableLabel(
    key: string,
    hasDisclosureConfig: boolean,
    disclosurePaths: Set<string>,
    disclosableFromMetadata?: boolean
  ): 'Yes' | 'No' | 'N/A' | 'Not configured' {
    if (this.isMdocFormat) {
      return 'N/A';
    }

    if (typeof disclosableFromMetadata === 'boolean') {
      return disclosableFromMetadata ? 'Yes' : 'No';
    }

    if (!hasDisclosureConfig) {
      return 'Not configured';
    }

    for (const disclosurePath of disclosurePaths) {
      if (
        this.isPrefixPathMatch(disclosurePath, key) ||
        this.isPrefixPathMatch(key, disclosurePath)
      ) {
        return 'Yes';
      }
    }

    return 'No';
  }

  private collectDisclosurePaths(
    frame: unknown,
    basePath: (string | number | null)[] = []
  ): Set<string> {
    const paths = new Set<string>();
    if (!frame || typeof frame !== 'object') {
      return paths;
    }

    const record = frame as Record<string, unknown>;

    // SD-JWT disclosure frame marks disclosable claims via _sd arrays.
    if (Array.isArray(record['_sd'])) {
      for (const claimName of record['_sd']) {
        if (typeof claimName === 'string' && claimName.length > 0) {
          paths.add(this.pathToKey([...basePath, claimName]));
        }
      }
    }

    for (const [key, value] of Object.entries(record)) {
      if (key === '_sd' || key.startsWith('_')) {
        continue;
      }

      if (value === true) {
        paths.add(this.pathToKey([...basePath, key]));
        continue;
      }

      const nested = this.collectDisclosurePaths(value, [...basePath, key]);
      for (const nestedPath of nested) {
        paths.add(nestedPath);
      }
    }

    return paths;
  }

  private isPrefixPathMatch(prefixPath: string, candidatePath: string): boolean {
    const prefix = prefixPath.split('.');
    const candidate = candidatePath.split('.');

    if (prefix.length > candidate.length) {
      return false;
    }

    for (let i = 0; i < prefix.length; i += 1) {
      if (prefix[i] === '*') {
        continue;
      }
      if (prefix[i] !== candidate[i]) {
        return false;
      }
    }

    return true;
  }

  private resolveMandatory(
    key: string,
    mandatoryFromMetadata: boolean | undefined,
    schemaPathInfo: SchemaPathInfo
  ): boolean | null {
    if (typeof mandatoryFromMetadata === 'boolean') {
      return mandatoryFromMetadata;
    }

    if (schemaPathInfo.required.has(key)) {
      return true;
    }

    if (schemaPathInfo.known.has(key)) {
      return false;
    }

    return null;
  }

  private collectSchemaPathInfo(schema: unknown): SchemaPathInfo {
    const required = new Set<string>();
    const known = new Set<string>();
    const types = new Map<string, string>();

    const walk = (
      node: unknown,
      path: (string | number | null)[] = [],
      parentRequired = false
    ): void => {
      if (!node || typeof node !== 'object') {
        return;
      }

      const record = node as Record<string, unknown>;
      const type = record['type'];

      if (type === 'array' || record['items']) {
        const arrayPath = [...path, null];
        const arrayKey = this.pathToKey(arrayPath);
        known.add(arrayKey);
        types.set(arrayKey, 'array');
        if (parentRequired) {
          required.add(arrayKey);
        }
        walk(record['items'], arrayPath, parentRequired);
      }

      const properties =
        record['properties'] && typeof record['properties'] === 'object'
          ? (record['properties'] as Record<string, unknown>)
          : undefined;
      const requiredProps = Array.isArray(record['required'])
        ? new Set(
            (record['required'] as unknown[]).filter(
              (value): value is string => typeof value === 'string'
            )
          )
        : new Set<string>();

      if (properties) {
        for (const [prop, child] of Object.entries(properties)) {
          const childPath = [...path, prop];
          const childKey = this.pathToKey(childPath);
          known.add(childKey);

          const childType = this.extractSchemaTypeLabel(child);
          if (childType) {
            types.set(childKey, childType);
          }

          const isRequiredHere = requiredProps.has(prop);
          if (isRequiredHere) {
            required.add(childKey);
          }

          walk(child, childPath, parentRequired && isRequiredHere);
        }
      }

      if (Array.isArray(record['oneOf'])) {
        for (const variant of record['oneOf'] as unknown[]) {
          walk(variant, path, parentRequired);
        }
      }
      if (Array.isArray(record['anyOf'])) {
        for (const variant of record['anyOf'] as unknown[]) {
          walk(variant, path, parentRequired);
        }
      }
      if (Array.isArray(record['allOf'])) {
        for (const variant of record['allOf'] as unknown[]) {
          walk(variant, path, parentRequired);
        }
      }
    };

    walk(schema, [], true);

    return { required, known, types };
  }

  private extractSchemaTypeLabel(node: unknown): string | null {
    if (!node || typeof node !== 'object') {
      return null;
    }

    const record = node as Record<string, unknown>;
    const typeValue = record['type'];
    if (typeof typeValue === 'string') {
      return typeValue;
    }
    if (Array.isArray(typeValue)) {
      const labels = typeValue.filter((v): v is string => typeof v === 'string');
      return labels.length > 0 ? labels.join(' | ') : null;
    }

    const mergedTypes = [record['oneOf'], record['anyOf'], record['allOf']]
      .filter(Array.isArray)
      .flatMap((variants) =>
        (variants as unknown[])
          .map((variant) => this.extractSchemaTypeLabel(variant))
          .filter((label): label is string => !!label)
      );
    if (mergedTypes.length > 0) {
      return Array.from(new Set(mergedTypes)).join(' | ');
    }

    if (record['properties'] && typeof record['properties'] === 'object') {
      return 'object';
    }
    if (record['items']) {
      return 'array';
    }

    return null;
  }

  private inferTypeFromValue(value: unknown): string | null {
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value === null) {
      return 'null';
    }
    const valueType = typeof value;
    if (valueType === 'object') {
      return 'object';
    }
    if (valueType === 'number') {
      return Number.isInteger(value as number) ? 'integer' : 'number';
    }
    if (valueType === 'string' || valueType === 'boolean') {
      return valueType;
    }
    return null;
  }

  private flattenObjectLeaves(
    value: unknown,
    path: (string | number | null)[] = []
  ): { path: (string | number | null)[]; value: unknown }[] {
    if (value === null || value === undefined) {
      return [];
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [{ path, value }];
      }
      return value.flatMap((item) => this.flattenObjectLeaves(item, [...path, null]));
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        return [{ path, value }];
      }

      return keys.flatMap((key) => this.flattenObjectLeaves(obj[key], [...path, key]));
    }

    return [{ path, value }];
  }

  private pathToKey(path: (string | number | null)[]): string {
    return path
      .map((segment) => (segment === null || typeof segment === 'number' ? '*' : String(segment)))
      .join('.');
  }

  private isRowComplete(row: ClaimFieldRow): boolean {
    const hasType = !!row.typeLabel;
    const hasMandatory = row.mandatory !== null;
    const hasDisclosable = this.isMdocFormat
      ? row.disclosableLabel === 'N/A'
      : row.disclosableLabel !== 'Not configured';

    return hasType && hasMandatory && hasDisclosable;
  }

  /**
   * Downloads the current configuration as a JSON file.
   */
  downloadConfig() {
    if (this.config) {
      downloadJsonFile(this.config, `credential-config-${this.config.id}.json`);
    }
    this.snackBar.open('Configuration downloaded', 'Close', {
      duration: 3000,
    });
  }

  asAny(obj: any) {
    return obj;
  }
}
