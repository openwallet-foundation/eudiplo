import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { AttributeProviderEntity } from '@eudiplo/sdk-core';
import { getApiKeyAuthType } from '../../../common/auth-display.util';
import { BaseAsyncListComponent } from '../../../common/base-async-list.component';
import { AttributeProviderService } from '../attribute-provider.service';

@Component({
  selector: 'app-attribute-provider-list',
  imports: [MatTableModule, MatIconModule, MatButtonModule, RouterModule, FlexLayoutModule],
  templateUrl: './attribute-provider-list.component.html',
  styleUrl: './attribute-provider-list.component.scss',
})
export class AttributeProviderListComponent extends BaseAsyncListComponent<AttributeProviderEntity> {
  get providers(): AttributeProviderEntity[] {
    return this.items;
  }

  displayedColumns: string[] = ['id', 'name', 'url', 'auth', 'actions'];

  constructor(private readonly attributeProviderService: AttributeProviderService) {
    super();
  }

  protected fetchItems(): Promise<AttributeProviderEntity[]> {
    return this.attributeProviderService.getAll();
  }

  getAuthType(provider: AttributeProviderEntity): string {
    return getApiKeyAuthType(provider.auth as { type?: string });
  }
}
