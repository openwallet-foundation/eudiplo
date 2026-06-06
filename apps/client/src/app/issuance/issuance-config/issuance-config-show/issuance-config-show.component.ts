import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { IssuanceConfig } from '@eudiplo/sdk-core';
import { downloadJsonFile } from '../../../common/download-json.util';
import { IssuanceConfigService } from '../issuance-config.service';

@Component({
  selector: 'app-issuance-config-show',
  imports: [
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
  templateUrl: './issuance-config-show.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './issuance-config-show.component.scss',
})
export class IssuanceConfigShowComponent implements OnInit {
  config?: IssuanceConfig;

  constructor(
    private readonly issuanceConfigService: IssuanceConfigService,
    private readonly snackBar: MatSnackBar,
    private readonly clipboard: Clipboard
  ) {}

  get primaryDisplay(): any {
    return this.config?.display?.[0];
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
    this.issuanceConfigService.getConfig().then(
      (config) => {
        this.config = config;
      },
      (error) => {
        this.snackBar.open('Failed to load config', 'Close', {
          duration: 3000,
        });
        console.error('Load error:', error);
      }
    );
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString();
  }

  /**
   * Downloads the current configuration as a JSON file.
   */
  downloadConfig() {
    if (this.config) {
      downloadJsonFile(this.config, 'issuance-config.json');
    }
    this.snackBar.open('Configuration downloaded', 'Close', {
      duration: 3000,
    });
  }
}
