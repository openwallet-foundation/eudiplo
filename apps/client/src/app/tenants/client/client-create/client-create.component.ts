import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type FormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  clientControllerCreateClient,
  clientControllerGetClient,
  clientControllerUpdateClient,
  credentialConfigControllerGetConfigs,
  type CreateClientDto,
  type UpdateClientDto,
} from '@eudiplo/sdk-core';
import { ApiService } from '../../../core';
import { JwtService, roles } from '../../../services/jwt.service';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PresentationManagementService } from '../../../presentation/presentation-config/presentation-management.service';
import { SecretDialogComponent } from '../secret-dialog/secret-dialog.component';

@Component({
  selector: 'app-client-create',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FlexLayoutModule,
    MatSelectModule,
    RouterModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './client-create.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './client-create.component.scss',
})
export class ClientCreateComponent implements OnInit {
  clientForm: FormGroup;
  isSubmitting = false;
  hasPermission = false;

  /** Roles available for selection - filtered based on current user's permissions */
  availableRoles = roles;
  loaded = false;
  id?: string | null;

  // Available configs for selection
  availablePresentationConfigs: string[] = [];
  availableIssuanceConfigs: string[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly apiService: ApiService,
    private readonly presentationManagementService: PresentationManagementService,
    private readonly dialog: MatDialog,
    private readonly jwtService: JwtService
  ) {
    this.clientForm = this.fb.group({
      clientId: ['', [Validators.required, Validators.minLength(1), this.clientIdValidator]],
      description: [''],
      roles: [[], [Validators.required]],
      allowedPresentationConfigs: [[]],
      allowedIssuanceConfigs: [[]],
    });

    // Filter out tenants:manage if current user doesn't have it
    if (!this.jwtService.hasRole('tenants:manage')) {
      this.availableRoles = roles.filter((r) => r !== 'tenants:manage');
    }
  }
  ngOnInit(): void {
    // Load available configs for the dropdowns
    this.loadAvailableConfigs();

    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id) {
      this.loaded = true;
      clientControllerGetClient({ path: { id: this.id } }).then((res) => {
        if (!res.data) {
          this.snackBar.open('Client not found', 'Close', { duration: 3000 });
          this.router.navigate(['../..'], { relativeTo: this.route });
          return;
        }
        // Type assertion needed until SDK is regenerated with new fields
        const clientData = res.data as typeof res.data & {
          allowedPresentationConfigs?: string[];
          allowedIssuanceConfigs?: string[];
        };
        this.clientForm.patchValue({
          ...clientData,
          allowedPresentationConfigs: clientData.allowedPresentationConfigs ?? [],
          allowedIssuanceConfigs: clientData.allowedIssuanceConfigs ?? [],
        });
        this.clientForm.get('clientId')?.disable();
      });
    }
  }

  private async loadAvailableConfigs(): Promise<void> {
    try {
      const [presentationConfigs, credentialConfigs] = await Promise.all([
        this.presentationManagementService.loadConfigurations(),
        credentialConfigControllerGetConfigs(),
      ]);
      this.availablePresentationConfigs = (presentationConfigs || []).map((c) => c.id);
      this.availableIssuanceConfigs = (credentialConfigs.data || []).map((c) => c.id);
    } catch (error) {
      console.error('Error loading available configs:', error);
    }
  }

  private buildCreateClientPayload(): CreateClientDto {
    const rawValue = this.clientForm.getRawValue() as Partial<CreateClientDto> & {
      clientId?: unknown;
      description?: unknown;
      allowedPresentationConfigs?: unknown;
      allowedIssuanceConfigs?: unknown;
      roles?: string[];
    };
    const clientId = typeof rawValue.clientId === 'string' ? rawValue.clientId.trim() : '';
    const description =
      typeof rawValue.description === 'string' ? rawValue.description.trim() : rawValue.description;

    return {
      clientId,
      description: description || undefined,
      roles: rawValue.roles ?? [],
      allowedPresentationConfigs: this.normalizeStringList(rawValue.allowedPresentationConfigs),
      allowedIssuanceConfigs: this.normalizeStringList(rawValue.allowedIssuanceConfigs),
    };
  }

  private buildUpdateClientPayload(): UpdateClientDto {
    const rawValue = this.clientForm.getRawValue() as Partial<UpdateClientDto> & {
      description?: unknown;
      allowedPresentationConfigs?: unknown;
      allowedIssuanceConfigs?: unknown;
      roles?: string[];
    };
    const description =
      typeof rawValue.description === 'string' ? rawValue.description.trim() : rawValue.description;

    return {
      description: description || undefined,
      roles: rawValue.roles ?? [],
      allowedPresentationConfigs: this.normalizeStringList(rawValue.allowedPresentationConfigs),
      allowedIssuanceConfigs: this.normalizeStringList(rawValue.allowedIssuanceConfigs),
    };
  }

  private clientIdValidator(control: { value: string | null | undefined }): Record<string, boolean> | null {
    const value = control.value?.trim();
    if (!value) {
      return null;
    }

    const validPattern = /^[A-Za-z0-9._:-]+$/;
    return validPattern.test(value) ? null : { invalidClientId: true };
  }

  private normalizeStringList(value: unknown): string[] | undefined {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      return [value.trim()];
    }

    return [];
  }

  async onSubmit(): Promise<void> {
    this.isSubmitting = true;

    try {
      if (this.loaded) {
        const payload = this.buildUpdateClientPayload();

        await clientControllerUpdateClient({
          path: { id: this.id! },
          body: payload,
        });
        this.snackBar.open('Client updated successfully', 'Close', {
          duration: 3000,
        });
        await this.router.navigate(['..'], { relativeTo: this.route });

        //in case user updated its own client, refresh the token
        if (this.apiService.getClientId() === this.id) {
          this.apiService.refreshAccessToken();
        }
      } else {
        const payload = this.buildCreateClientPayload();

        const result = await clientControllerCreateClient({
          body: payload,
        });

        // Cast to expected type since SDK returns generic response
        const clientData = result.data as typeof result.data & { clientSecret?: string };

        // Show secret dialog for new clients
        if (clientData?.clientSecret) {
          const dialogRef = this.dialog.open(SecretDialogComponent, {
            data: {
              clientId: clientData.clientId,
              secret: clientData.clientSecret,
              apiUrl: this.apiService.getBaseUrl(),
            },
            width: '500px',
            disableClose: true,
          });

          // Wait for dialog to close before navigating
          dialogRef.afterClosed().subscribe(() => {
            this.router.navigate(['..'], { relativeTo: this.route });
          });
        } else {
          this.snackBar.open('Client created successfully', 'Close', {
            duration: 3000,
          });
          await this.router.navigate(['..'], { relativeTo: this.route });
        }
      }
    } catch (error) {
      this.snackBar.open(
        error instanceof Error
          ? error.message
          : `Failed to ${this.loaded ? 'update' : 'create'} client`,
        'Close',
        { duration: 5000 }
      );
    } finally {
      this.isSubmitting = false;
    }
  }

  onCancel(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
