import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { WebhookEndpointEntity } from '@eudiplo/sdk-core';
import { getApiKeyAuthType } from '../../common/auth-display.util';
import { BaseAsyncListComponent } from '../../common/base-async-list.component';
import { WebhookEndpointService } from '../webhook-endpoint.service';

@Component({
  selector: 'app-webhook-endpoint-list',
  imports: [MatTableModule, MatIconModule, MatButtonModule, RouterModule, FlexLayoutModule],
  templateUrl: './webhook-endpoint-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './webhook-endpoint-list.component.scss',
})
export class WebhookEndpointListComponent extends BaseAsyncListComponent<WebhookEndpointEntity> {
  get endpoints(): WebhookEndpointEntity[] {
    return this.items;
  }

  displayedColumns: string[] = ['id', 'name', 'url', 'auth', 'actions'];

  constructor(private readonly webhookEndpointService: WebhookEndpointService) {
    super();
  }

  protected fetchItems(): Promise<WebhookEndpointEntity[]> {
    return this.webhookEndpointService.getAll();
  }

  getAuthType(endpoint: WebhookEndpointEntity): string {
    return getApiKeyAuthType(endpoint.auth as { type?: string });
  }
}
