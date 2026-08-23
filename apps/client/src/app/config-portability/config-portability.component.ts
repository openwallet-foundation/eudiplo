import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { getApiErrorMessage } from '../utils/error-message';
import { JwtService } from '../services/jwt.service';
import {
  ConfigBundle,
  ConfigImportMode,
  ConfigImportPlan,
  ConfigPortabilityService,
  ConfigResourceMetadata,
} from './config-portability.service';

@Component({
  selector: 'app-config-portability',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTableModule,
  ],
  templateUrl: './config-portability.component.html',
  styleUrl: './config-portability.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConfigPortabilityComponent implements OnInit {
  readonly planColumns = ['resource', 'version', 'action', 'issues'];
  readonly resourceColumns = ['resource', 'ownership', 'generation', 'source', 'actions'];
  mode: ConfigImportMode = 'upsert';
  bundle?: ConfigBundle;
  bundleArchive?: File;
  bundleFileName = '';
  plan?: ConfigImportPlan;
  resources: ConfigResourceMetadata[] = [];
  busy = false;

  constructor(
    private readonly portability: ConfigPortabilityService,
    private readonly snackBar: MatSnackBar,
    private readonly jwt: JwtService
  ) {}

  get canApply(): boolean {
    return this.jwt.hasRole('tenants:manage');
  }

  ngOnInit(): void {
    void this.refreshResources();
  }

  async exportBundle(): Promise<void> {
    await this.run(async () => {
      const bundle = await this.portability.exportArchive();
      const date = new Date().toISOString().slice(0, 10);
      this.download(bundle, `eudiplo-config-${date}.zip`);
      this.snackBar.open('Configuration archive exported', 'Close', {
        duration: 3000,
      });
    }, 'Configuration export failed');
  }

  async exportEditableJson(): Promise<void> {
    await this.run(async () => {
      const bundle = await this.portability.exportBundle();
      const date = new Date().toISOString().slice(0, 10);
      this.download(
        new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
        `eudiplo-config-${date}.json`
      );
      this.snackBar.open('Editable configuration bundle exported', 'Close', {
        duration: 3000,
      });
    }, 'Configuration export failed');
  }

  async selectBundle(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        this.bundleArchive = file;
        this.bundle = undefined;
      } else {
        const parsed = JSON.parse(await file.text()) as ConfigBundle;
        if (
          parsed.manifest?.format !== 'eudiplo.config-bundle' ||
          !Array.isArray(parsed.documents)
        ) {
          throw new Error('This is not an EUDIPLO configuration bundle');
        }
        this.bundle = parsed;
        this.bundleArchive = undefined;
      }
      this.bundleFileName = file.name;
      this.plan = undefined;
    } catch (error) {
      this.bundle = undefined;
      this.bundleArchive = undefined;
      this.bundleFileName = '';
      this.snackBar.open(getApiErrorMessage(error, 'Could not read bundle'), 'Close', {
        duration: 5000,
      });
    } finally {
      input.value = '';
    }
  }

  async planImport(): Promise<void> {
    if (!this.bundle && !this.bundleArchive) return;
    await this.run(async () => {
      this.plan = this.bundleArchive
        ? await this.portability.planArchive(this.bundleArchive, this.mode)
        : await this.portability.plan(this.bundle!, this.mode);
    }, 'Import plan failed');
  }

  async applyImport(): Promise<void> {
    if ((!this.bundle && !this.bundleArchive) || !this.plan?.applicable) return;
    const confirmed =
      this.mode !== 'replace' ||
      globalThis.confirm(
        'Replace mode deletes file-managed resources from this bundle source that are not in the bundle. Continue?'
      );
    if (!confirmed) return;
    await this.run(async () => {
      this.plan = this.bundleArchive
        ? await this.portability.importArchive(this.bundleArchive, this.mode, confirmed)
        : await this.portability.import(this.bundle!, this.mode, confirmed);
      await this.refreshResources();
      this.snackBar.open('Configuration bundle imported', 'Close', { duration: 3000 });
    }, 'Configuration import failed');
  }

  async detach(resource: ConfigResourceMetadata): Promise<void> {
    if (
      !globalThis.confirm(
        `Detach ${resource.kind}/${resource.resourceId}? It will become editable through the API and UI.`
      )
    ) {
      return;
    }
    await this.run(async () => {
      await this.portability.detach(resource.kind, resource.resourceId);
      await this.refreshResources();
    }, 'Could not detach resource');
  }

  onModeChange(): void {
    this.plan = undefined;
  }

  downloadImportResult(): void {
    if (!this.plan?.generatedSecrets?.length) return;
    this.download(
      new Blob([JSON.stringify({ generatedSecrets: this.plan.generatedSecrets }, null, 2)], {
        type: 'application/json',
      }),
      'eudiplo-import-secrets.json'
    );
  }

  private async refreshResources(): Promise<void> {
    try {
      this.resources = await this.portability.listResources();
    } catch (error) {
      this.snackBar.open(getApiErrorMessage(error, 'Could not load resource ownership'), 'Close', {
        duration: 5000,
      });
    }
  }

  private async run(operation: () => Promise<void>, fallback: string): Promise<void> {
    this.busy = true;
    try {
      await operation();
    } catch (error) {
      this.snackBar.open(getApiErrorMessage(error, fallback), 'Close', { duration: 6000 });
    } finally {
      this.busy = false;
    }
  }

  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
