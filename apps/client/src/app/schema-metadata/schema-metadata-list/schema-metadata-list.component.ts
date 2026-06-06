import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { SchemaMetadata, SchemaMetadataService } from '../schema-metadata.service';

interface GroupedSchemaMetadata {
  id: string;
  issuer: string;
  updatedAt: string;
  versions: string[];
}

@Component({
  selector: 'app-schema-metadata-list',
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
    RouterModule,
    FlexLayoutModule,
  ],
  templateUrl: './schema-metadata-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './schema-metadata-list.component.scss',
})
export class SchemaMetadataListComponent implements OnInit {
  items: SchemaMetadata[] = [];
  groupedItems: GroupedSchemaMetadata[] = [];
  loading = false;

  get schemaMetadataCount(): number {
    return this.groupedItems.length;
  }

  get schemaMetadataVersionCount(): number {
    return this.items.length;
  }

  displayedColumns: (keyof GroupedSchemaMetadata | 'actions')[] = [
    'id',
    'versions',
    'issuer',
    'updatedAt',
    'actions',
  ];

  constructor(
    private readonly schemaMetadataService: SchemaMetadataService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadItems();
  }

  async loadItems(): Promise<void> {
    this.loading = true;
    try {
      this.items = await this.schemaMetadataService.list();
      this.groupedItems = this.groupById(this.items);
    } catch (error) {
      console.error('Failed to load schema metadata:', error);
      this.snackBar.open('Failed to load schema metadata', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  private groupById(items: SchemaMetadata[]): GroupedSchemaMetadata[] {
    const groups = new Map<string, GroupedSchemaMetadata>();

    for (const item of items) {
      const existing = groups.get(item.id);
      if (!existing) {
        groups.set(item.id, {
          id: item.id,
          issuer: item.issuer,
          updatedAt: item.updatedAt,
          versions: [item.version],
        });
        continue;
      }

      existing.versions.push(item.version);
      if (new Date(item.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
        existing.updatedAt = item.updatedAt;
        existing.issuer = item.issuer;
      }
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        versions: Array.from(new Set(group.versions)).sort((a, b) => this.compareSemverDesc(a, b)),
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
