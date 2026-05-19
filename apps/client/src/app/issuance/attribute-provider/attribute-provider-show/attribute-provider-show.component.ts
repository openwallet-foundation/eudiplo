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
import { AttributeProviderEntity } from '@eudiplo/sdk-core';
import { getApiKeyAuthType, getApiKeyHeaderName } from '../../../common/auth-display.util';
import { downloadJsonFile } from '../../../common/download-json.util';
import { AttributeProviderService } from '../attribute-provider.service';

@Component({
  selector: 'app-attribute-provider-show',
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
  templateUrl: './attribute-provider-show.component.html',
  styleUrl: './attribute-provider-show.component.scss',
})
export class AttributeProviderShowComponent implements OnInit {
  provider: AttributeProviderEntity | undefined;

  constructor(
    private readonly attributeProviderService: AttributeProviderService,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.attributeProviderService.getById(id).then(
        (provider) => (this.provider = provider),
        (error) => {
          this.snackBar.open('Failed to load attribute provider', 'Close', { duration: 3000 });
          console.error('Load error:', error);
        }
      );
    }
  }

  getAuthType(): string {
    return getApiKeyAuthType(this.provider?.auth as { type?: string } | undefined);
  }

  getAuthHeaderName(): string | null {
    return getApiKeyHeaderName(
      this.provider?.auth as { type?: string; config?: { headerName?: string } } | undefined
    );
  }

  deleteProvider(): void {
    if (this.provider && confirm('Are you sure you want to delete this attribute provider?')) {
      this.attributeProviderService
        .delete(this.provider.id)
        .then(() => {
          this.snackBar.open('Attribute provider deleted successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['../'], { relativeTo: this.route });
        })
        .catch((error) => {
          this.snackBar.open('Failed to delete attribute provider', 'Close', { duration: 3000 });
          console.error('Delete error:', error);
        });
    }
  }

  downloadConfig(): void {
    if (this.provider) {
      const config = { ...(this.provider as any) };
      delete config.tenantId;
      delete config.tenant;
      downloadJsonFile(config, `attribute-provider-${this.provider.id}.json`);
    }
    this.snackBar.open('Configuration downloaded', 'Close', { duration: 3000 });
  }
}
