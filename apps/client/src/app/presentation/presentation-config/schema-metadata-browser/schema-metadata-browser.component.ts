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
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { JsonPipe } from '@angular/common';
import {
  CatalogEntry,
  ResolvedSchemaMetadata,
  SchemaMetadataImportResult,
  SchemaMetadataBrowserService,
} from './schema-metadata-browser.service';

export interface SchemaMetadataBrowserDialogData {
  initialUrl?: string;
}

@Component({
  selector: 'app-schema-metadata-browser',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
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
  providers: [SchemaMetadataBrowserService],
  templateUrl: './schema-metadata-browser.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './schema-metadata-browser.component.scss',
})
export class SchemaMetadataBrowserComponent implements OnInit {
  urlControl = new FormControl('', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]);

  loading = false;
  error: string | null = null;
  resolved: ResolvedSchemaMetadata | null = null;

  selectedFormats = new Map<string, boolean>();

  // Catalog browse state
  catalogLoading = false;
  catalogError: string | null = null;
  catalogEntries: CatalogEntry[] = [];
  catalogFilter = '';
  catalogLoaded = false;

  constructor(
    public dialogRef: MatDialogRef<SchemaMetadataBrowserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SchemaMetadataBrowserDialogData | null,
    private readonly schemaMetadataService: SchemaMetadataBrowserService
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
      this.resolved = await this.schemaMetadataService.fetchSchemaMetadata(this.urlControl.value!);
      for (const format of this.resolved.schema.supportedFormats) {
        this.selectedFormats.set(format, true);
      }
    } catch (err: any) {
      console.error('Failed to fetch schema metadata:', err);
      if (err.status === 0) {
        this.error =
          'Failed to fetch schema metadata through the EUDIPLO proxy. Check network connectivity and URL, then try again.';
      } else if (err.status === 404) {
        this.error = 'Schema metadata not found at the specified URL.';
      } else {
        this.error = err.message || 'Failed to fetch schema metadata.';
      }
    } finally {
      this.loading = false;
    }
  }

  async loadCatalog(): Promise<void> {
    if (this.catalogLoaded) return;
    this.catalogLoading = true;
    this.catalogError = null;

    try {
      this.catalogEntries = await this.schemaMetadataService.fetchCatalog();
      this.catalogLoaded = true;
    } catch (err: any) {
      console.error('Failed to load catalog:', err);
      this.catalogError = err.error?.message || err.message || 'Failed to load catalog.';
    } finally {
      this.catalogLoading = false;
    }
  }

  get filteredCatalogEntries(): CatalogEntry[] {
    const q = this.catalogFilter.toLowerCase().trim();
    if (!q) return this.catalogEntries;
    return this.catalogEntries.filter(
      (e) =>
        (e.name ?? '').toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q) ||
        (e.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }

  selectFromCatalog(entry: CatalogEntry): void {
    this.resolved = this.schemaMetadataService.catalogEntryToResolved(entry);
    this.selectedFormats.clear();
    for (const format of this.resolved.schema.supportedFormats) {
      this.selectedFormats.set(format, true);
    }
    this.error = null;
  }

  toggleFormat(format: string, selected: boolean): void {
    this.selectedFormats.set(format, selected);
  }

  hasSelections(): boolean {
    return Array.from(this.selectedFormats.values()).some((selected) => selected);
  }

  getSelectedFormats(): string[] {
    return Array.from(this.selectedFormats.entries())
      .filter(([, selected]) => selected)
      .map(([format]) => format);
  }

  getGeneratedDcql(): object {
    if (!this.resolved) {
      return { credentials: [] };
    }

    return this.schemaMetadataService.generateDcqlQuery(this.resolved, this.getSelectedFormats());
  }

  close(): void {
    this.dialogRef.close();
  }

  insert(): void {
    if (!this.resolved || !this.hasSelections()) return;
    const importResult: SchemaMetadataImportResult =
      this.schemaMetadataService.generateImportResult(this.resolved, this.getSelectedFormats());
    this.dialogRef.close(importResult);
  }
}
