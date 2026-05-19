import { Component, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { WebhookEndpointEntity } from '@eudiplo/sdk-core';
import { getApiKeyAuthType, getApiKeyHeaderName } from '../../common/auth-display.util';
import { downloadJsonFile } from '../../common/download-json.util';
import { WebhookEndpointService } from '../webhook-endpoint.service';

@Component({
  selector: 'app-webhook-endpoint-show',
  imports: [
    CommonModule,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTooltipModule,
    MatListModule,
    FlexLayoutModule,
    RouterModule,
  ],
  templateUrl: './webhook-endpoint-show.component.html',
  styleUrl: './webhook-endpoint-show.component.scss',
})
export class WebhookEndpointShowComponent implements OnInit {
  endpoint: WebhookEndpointEntity | undefined;

  constructor(
    private readonly webhookEndpointService: WebhookEndpointService,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.webhookEndpointService.getById(id).then(
        (endpoint) => (this.endpoint = endpoint),
        (error) => {
          this.snackBar.open('Failed to load webhook endpoint', 'Close', { duration: 3000 });
          console.error('Load error:', error);
        }
      );
    }
  }

  getAuthType(): string {
    return getApiKeyAuthType(this.endpoint?.auth as { type?: string } | undefined);
  }

  getAuthHeaderName(): string | null {
    return getApiKeyHeaderName(
      this.endpoint?.auth as { type?: string; config?: { headerName?: string } } | undefined
    );
  }

  deleteEndpoint(): void {
    if (this.endpoint && confirm('Are you sure you want to delete this webhook endpoint?')) {
      this.webhookEndpointService
        .delete(this.endpoint.id)
        .then(() => {
          this.snackBar.open('Webhook endpoint deleted successfully', 'Close', { duration: 3000 });
          this.router.navigate(['../'], { relativeTo: this.route });
        })
        .catch((error) => {
          this.snackBar.open('Failed to delete webhook endpoint', 'Close', { duration: 3000 });
          console.error('Delete error:', error);
        });
    }
  }

  downloadConfig(): void {
    if (this.endpoint) {
      const config = { ...(this.endpoint as any) };
      delete config.tenantId;
      delete config.tenant;
      downloadJsonFile(config, `webhook-endpoint-${this.endpoint.id}.json`);
    }
    this.snackBar.open('Configuration downloaded', 'Close', { duration: 3000 });
  }
}
