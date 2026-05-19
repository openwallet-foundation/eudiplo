import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { PresentationConfig } from '@eudiplo/sdk-core';
import { PresentationManagementService } from '../presentation-management.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WebhookConfigShowComponent } from '../../../utils/webhook-config-show/webhook-config-show.component';
import { presentationManagementControllerReissueRegistrationCertificate } from '@eudiplo/sdk-core';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import {
  formatRegistrationCertExpiresIn,
  getRegistrationCertStatus,
  type RegistrationCertStatus,
} from '../../../utils/registration-cert-status';
import { downloadJsonFile } from '../../../common/download-json.util';

@Component({
  selector: 'app-presentation-show',
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTooltipModule,
    MatListModule,
    MatChipsModule,
    MatDividerModule,
    MatExpansionModule,
    MatTabsModule,
    FlexLayoutModule,
    RouterModule,
    ClipboardModule,
    WebhookConfigShowComponent,
  ],
  templateUrl: './presentation-show.component.html',
  styleUrls: ['./presentation-show.component.scss'],
})
export class PresentationShowComponent implements OnInit {
  config?: PresentationConfig;
  reissuing = false;

  constructor(
    private readonly presentationService: PresentationManagementService,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly clipboard: Clipboard
  ) {}

  ngOnInit(): void {
    this.loadPresentation();
  }

  async loadPresentation(): Promise<void> {
    try {
      const presentationId = this.route.snapshot.paramMap.get('id');
      if (presentationId) {
        this.config = await this.presentationService.getPresentationById(presentationId);
      }
    } catch (error) {
      console.error('Error loading presentation:', error);
    }
  }

  get credentialQueries(): any[] {
    return this.config?.dcql_query?.credentials || [];
  }

  get registrationCertStatus(): RegistrationCertStatus {
    return getRegistrationCertStatus(this.config);
  }

  get registrationCertExpiresIn(): string | null {
    return formatRegistrationCertExpiresIn(this.config?.registrationCertCache as any);
  }

  get registrationCertCache(): {
    jwt?: string;
    source?: string;
    issuedAt?: number;
    expiresAt?: number;
  } | null {
    return (this.config?.registrationCertCache as any) ?? null;
  }

  get registrationCertJwt(): string | null {
    const cachedJwt = this.registrationCertCache?.jwt;
    if (cachedJwt) return cachedJwt;

    const configuredJwt = (this.config as any)?.registration_cert?.jwt;
    return typeof configuredJwt === 'string' && configuredJwt.length > 0 ? configuredJwt : null;
  }

  get parsedRegistrationCertHeader(): string {
    const jwt = this.registrationCertJwt;
    if (!jwt) return 'No registration certificate JWT available';

    try {
      return JSON.stringify(decodeProtectedHeader(jwt), null, 2);
    } catch (error) {
      return `Unable to decode JWT header: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  get parsedRegistrationCertPayload(): string {
    const jwt = this.registrationCertJwt;
    if (!jwt) return 'No registration certificate JWT available';

    try {
      return JSON.stringify(decodeJwt(jwt), null, 2);
    } catch (error) {
      return `Unable to decode JWT payload: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  reissueRegistrationCert(): void {
    if (!this.config) return;
    this.reissuing = true;
    presentationManagementControllerReissueRegistrationCertificate({
      path: { id: this.config.id },
    })
      .then((res: any) => {
        if (res?.data) {
          this.config = res.data;
        }
        this.snackBar.open('Registration certificate reissued', 'Close', {
          duration: 3000,
        });
      })
      .catch((err) => {
        console.error('Failed to reissue registration certificate', err);
        this.snackBar.open('Failed to reissue registration certificate', 'Close', {
          duration: 4000,
        });
      })
      .finally(() => {
        this.reissuing = false;
      });
  }

  copyToClipboard(value: string, label: string): void {
    this.clipboard.copy(value);
    this.snackBar.open(`${label} copied to clipboard`, 'Close', {
      duration: 2000,
    });
  }

  formatLifetime(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }

  formatJsonValue(value: any): string {
    return JSON.stringify(value, null, 2);
  }

  deletePresentation() {
    if (this.config && confirm('Are you sure you want to delete this presentation?')) {
      this.presentationService
        .deleteConfiguration(this.config.id)
        .then(() => {
          this.snackBar.open('Presentation deleted successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['../'], { relativeTo: this.route });
        })
        .catch((error) => {
          this.snackBar.open('Failed to delete presentation', 'Close', {
            duration: 3000,
          });
          console.error('Delete error:', error);
        });
    }
  }

  /**
   * Downloads the current configuration as a JSON file.
   */
  downloadConfig() {
    if (this.config) {
      const exportConfig: any = { ...this.config };
      if (this.registrationCertJwt) {
        exportConfig.registration_cert = {
          ...((this.config as any).registration_cert ?? {}),
          jwt: this.registrationCertJwt,
        };
      }
      delete exportConfig.registrationCertCache;

      downloadJsonFile(exportConfig, `presentation-config-${this.config.id}.json`);
    }
    this.snackBar.open('Configuration downloaded', 'Close', {
      duration: 3000,
    });
  }
}
