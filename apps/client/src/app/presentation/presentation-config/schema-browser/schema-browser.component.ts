import { Component, Inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { JsonPipe } from '@angular/common';
import {
  CatalogEntry,
  ResolvedSchema,
  SchemaImportResult,
  SchemaBrowserService,
} from './schema-browser.service';

export interface SchemaBrowserDialogData {
  initialUrl?: string;
}

interface CatalogGroup {
  id: string;
  entries: CatalogEntry[];
  selectedEntry: CatalogEntry;
}

@Component({
  selector: 'app-schema-browser',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTabsModule,
    MatChipsModule,
    MatListModule,
    ReactiveFormsModule,
    FormsModule,
    FlexLayoutModule,
    JsonPipe,
  ],
  providers: [SchemaBrowserService],
  templateUrl: './schema-browser.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './schema-browser.component.scss',
})
export class SchemaBrowserComponent implements OnInit {
  urlControl = new FormControl('', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]);

  loading = false;
  error: string | null = null;
  resolved: ResolvedSchema | null = null;

  selectedFormats = new Map<string, boolean>();

  // Catalog browse state
  catalogLoading = false;
  catalogError: string | null = null;
  catalogEntries: CatalogEntry[] = [];
  catalogFilter = '';
  catalogCategoryFilter = '';
  catalogFormatFilter = '';
  catalogIncludeDeprecated = false;
  catalogLoaded = false;
  private readonly selectedCatalogVersions = new Map<string, string>();

  constructor(
    public dialogRef: MatDialogRef<SchemaBrowserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SchemaBrowserDialogData | null,
    private readonly schemaBrowserService: SchemaBrowserService
  ) {}

  ngOnInit(): void {
    if (this.data?.initialUrl) {
      this.urlControl.setValue(this.data.initialUrl);
      this.fetchSchemaMetadata();
    }
  }

  async fetchSchemaMetadata(): Promise<void> {
    if (this.urlControl.invalid) return;

    this.loading = true;
    this.error = null;
    this.resolved = null;
    this.selectedFormats.clear();

    try {
      this.resolved = await this.schemaBrowserService.fetchSchema(this.urlControl.value!);
      for (const format of this.resolved.schema.supportedFormats) {
        this.selectedFormats.set(format, true);
      }
    } catch (err: any) {
      console.error('Failed to fetch schema metadata:', err);
      if (err.status === 0) {
        this.error =
          'Failed to fetch schema through the EUDIPLO proxy. Check network connectivity and URL, then try again.';
      } else if (err.status === 404) {
        this.error = 'Schema not found at the specified URL.';
      } else {
        this.error = err.message || 'Failed to fetch schema.';
      }
    } finally {
      this.loading = false;
    }
  }

  async loadCatalog(force = false): Promise<void> {
    if (this.catalogLoaded && !force) return;
    this.catalogLoading = true;
    this.catalogError = null;

    try {
      this.catalogEntries = await this.schemaBrowserService.fetchCatalog();
      this.catalogLoaded = true;
      this.syncSelectedCatalogVersions();
    } catch (err: any) {
      console.error('Failed to load catalog:', err);
      this.catalogError = err.error?.message || err.message || 'Failed to load catalog.';
    } finally {
      this.catalogLoading = false;
    }
  }

  async refreshCatalog(): Promise<void> {
    await this.loadCatalog(true);
  }

  get catalogCategories(): string[] {
    return Array.from(
      new Set(this.catalogEntries.map((entry) => entry.category).filter(Boolean) as string[])
    ).sort((a, b) => a.localeCompare(b));
  }

  get catalogFormats(): string[] {
    return Array.from(new Set(this.catalogEntries.flatMap((entry) => entry.supportedFormats))).sort(
      (a, b) => a.localeCompare(b)
    );
  }

  get filteredCatalogGroups(): CatalogGroup[] {
    const groups = new Map<string, CatalogEntry[]>();

    for (const entry of this.catalogEntries.filter((item) => this.matchesCatalogFilters(item))) {
      const existing = groups.get(entry.id) ?? [];
      existing.push(entry);
      groups.set(entry.id, existing);
    }

    return Array.from(groups.entries())
      .map(([id, entries]) => {
        const sortedEntries = [...entries].sort((a, b) =>
          this.compareVersionsDesc(a.version, b.version)
        );
        return {
          id,
          entries: sortedEntries,
          selectedEntry: this.resolveSelectedCatalogEntry(id, sortedEntries),
        };
      })
      .sort((a, b) =>
        this.catalogTitle(a.selectedEntry).localeCompare(this.catalogTitle(b.selectedEntry))
      );
  }

  catalogDescription(entry: CatalogEntry): string | undefined {
    return entry.issuerOffers.find((offer) => offer.description)?.description;
  }

  catalogTitle(entry: CatalogEntry): string {
    return entry.displayName || entry.id;
  }

  catalogMeta(entry: CatalogEntry): string {
    return [entry.issuer, entry.category, entry.attestationLoS, entry.bindingType]
      .filter(Boolean)
      .join(' · ');
  }

  selectCatalogVersion(group: CatalogGroup, version: string): void {
    this.selectedCatalogVersions.set(group.id, version);
  }

  private matchesCatalogFilters(entry: CatalogEntry): boolean {
    const query = this.catalogFilter.toLowerCase().trim();
    const description = this.catalogDescription(entry) ?? '';
    const matchesQuery =
      !query ||
      this.catalogTitle(entry).toLowerCase().includes(query) ||
      entry.id.toLowerCase().includes(query) ||
      entry.issuer.toLowerCase().includes(query) ||
      (entry.category ?? '').toLowerCase().includes(query) ||
      (entry.tags ?? []).some((tag) => tag.toLowerCase().includes(query)) ||
      description.toLowerCase().includes(query);

    return (
      matchesQuery &&
      (!this.catalogCategoryFilter || entry.category === this.catalogCategoryFilter) &&
      (!this.catalogFormatFilter ||
        entry.supportedFormats.includes(this.catalogFormatFilter as any)) &&
      (this.catalogIncludeDeprecated || !entry.deprecated)
    );
  }

  private syncSelectedCatalogVersions(): void {
    const grouped = new Map<string, CatalogEntry[]>();
    for (const entry of this.catalogEntries) {
      const entries = grouped.get(entry.id) ?? [];
      entries.push(entry);
      grouped.set(entry.id, entries);
    }

    for (const [id, entries] of grouped.entries()) {
      if (this.selectedCatalogVersions.has(id)) continue;
      const latestActive = [...entries]
        .filter((entry) => !entry.deprecated)
        .sort((a, b) => this.compareVersionsDesc(a.version, b.version))[0];
      const latest = [...entries].sort((a, b) => this.compareVersionsDesc(a.version, b.version))[0];
      this.selectedCatalogVersions.set(id, (latestActive ?? latest).version);
    }
  }

  private resolveSelectedCatalogEntry(id: string, entries: CatalogEntry[]): CatalogEntry {
    const selectedVersion = this.selectedCatalogVersions.get(id);
    return entries.find((entry) => entry.version === selectedVersion) ?? entries[0];
  }

  private compareVersionsDesc(a: string, b: string): number {
    return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
  }

  async selectFromCatalog(entry: CatalogEntry): Promise<void> {
    this.loading = true;
    this.error = null;
    this.resolved = null;
    this.selectedFormats.clear();

    try {
      // Fetch and resolve the full metadata via the catalog entry
      this.resolved = await this.schemaBrowserService.resolveCatalogEntry(entry);
      for (const format of this.resolved.schema.supportedFormats) {
        this.selectedFormats.set(format, true);
      }
    } catch (err: any) {
      console.error('Failed to load catalog entry:', err);
      this.error = err.message || 'Failed to load schema from catalog.';
    } finally {
      this.loading = false;
    }
  }

  toggleFormat(format: string, selected: boolean): void {
    this.selectedFormats.set(format, selected);
  }

  hasSelections(): boolean {
    return Array.from(this.selectedFormats.values()).some(Boolean);
  }

  getSelectedFormats(): string[] {
    return Array.from(this.selectedFormats.entries())
      .filter(([, selected]) => selected)
      .map(([format]) => format);
  }

  getResolvedReferences(): {
    format: string;
    uri: string;
    integrity?: string;
    meta?: Record<string, unknown>;
    parsedSchema?: Record<string, unknown>;
  }[] {
    return this.resolved?.schema.resolvedReferences ?? [];
  }

  hasResolvedReferences(): boolean {
    return this.getResolvedReferences().length > 0;
  }

  getGeneratedDcql(): object {
    if (!this.resolved?.schema.dcqlQuery) {
      return { credentials: [] };
    }

    const selected = new Set(this.getSelectedFormats());
    const allCredentials =
      (this.resolved.schema.dcqlQuery as { credentials?: Record<string, unknown>[] }).credentials ??
      [];

    return {
      credentials: allCredentials.filter((credential) => {
        const format = credential['format'];
        return typeof format === 'string' && selected.has(format);
      }),
    };
  }

  close(): void {
    this.dialogRef.close();
  }

  insert(): void {
    if (!this.resolved || !this.hasSelections()) return;
    const importResult: SchemaImportResult = this.schemaBrowserService.generateImportResult(
      this.resolved,
      this.getSelectedFormats()
    );
    this.dialogRef.close(importResult);
  }
}
