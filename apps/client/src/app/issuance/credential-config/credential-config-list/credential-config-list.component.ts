import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { CredentialConfig } from '@eudiplo/sdk-core';
import { BaseAsyncListComponent } from '../../../common/base-async-list.component';
import { CredentialConfigService } from '../credential-config.service';
import { DisplayFormValue } from '../credential-config.types';

@Component({
  selector: 'app-credential-config-list',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterModule,
    FlexLayoutModule,
  ],
  templateUrl: './credential-config-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './credential-config-list.component.scss',
})
export class CredentialConfigListComponent extends BaseAsyncListComponent<CredentialConfig> {
  get configs(): CredentialConfig[] {
    return this.items;
  }

  displayedColumns: (keyof CredentialConfig | 'description' | 'schemaMetadata' | 'actions')[] = [
    'id',
    'description',
    'schemaMetadata',
    'keyBinding',
    'lifeTime',
    'embeddedDisclosurePolicy',
    'statusManagement',
    'actions',
  ];

  constructor(private readonly credentialConfigService: CredentialConfigService) {
    super();
  }

  protected fetchItems(): Promise<CredentialConfig[]> {
    return this.credentialConfigService.loadConfigurations();
  }

  getDescription(config: CredentialConfig): string {
    return (
      ((config.config as any).display as DisplayFormValue[])[0]?.description ||
      'No description available'
    );
  }

  getSchemaMetadataId(config: CredentialConfig): string | null {
    const id = (config as any)?.schemaMeta?.id;
    return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null;
  }
}
