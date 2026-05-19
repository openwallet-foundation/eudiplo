import { Component, type OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';

import { FlexLayoutModule } from 'ngx-flexible-layout';
import { EnvironmentService } from '../services/environment.service';
import { ApiService } from '../core';
import { OidcService } from '../core/oidc.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatSnackBarModule,
    MatTabsModule,
    FlexLayoutModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  hideClientSecret = true;
  isDevelopmentMode = false;
  detectedMode: null | 'loading' | 'local' | 'oidc' = null;
  selectedLoginMode: 'sso' | 'client' = 'sso';
  private discoveredIssuer?: string;
  private discoveredUiClientId?: string;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly apiService: ApiService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly environmentService: EnvironmentService,
    private readonly oidcService: OidcService
  ) {}

  ngOnInit(): void {
    this.isDevelopmentMode = this.environmentService.isDevelopment();

    // Check if user is already authenticated
    if (this.apiService.getAuthenticationStatus()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    console.log('Initializing login form');
    this.initializeForm();

    const initialApiUrl = this.loginForm.get('apiUrl')?.value;
    if (initialApiUrl) {
      void this.detectMode(initialApiUrl);
    }

    // Auto-login if all required params are provided via URL
    this.autoLoginIfParamsProvided();
  }

  private autoLoginIfParamsProvided(): void {
    const queryParams = this.route.snapshot.queryParams;

    // Check if all required params are in the URL
    if (queryParams['clientId'] && queryParams['clientSecret'] && queryParams['apiUrl']) {
      this.selectedLoginMode = 'client';
      this.syncLoginModeState();
      console.log('Auto-login: All credentials provided via URL');
      void this.onSubmit();
    }
  }

  private initializeForm(): void {
    const env = this.environmentService.getEnvironment();
    const queryParams = this.route.snapshot.queryParams;

    // Priority order: URL params > environment values (in dev) > empty strings
    const getParamValue = (paramName: string, envValue: string): string => {
      // First check URL query parameters
      if (queryParams[paramName]) {
        return queryParams[paramName];
      }

      // Then check environment values if in development mode
      if (this.environmentService.isDevelopment() && envValue) {
        return envValue;
      }

      //check if defined in window
      if ((globalThis as any).env?.[paramName]) {
        return (globalThis as any).env[paramName];
      }

      // Default to empty string
      return '';
    };

    const defaultValues = {
      clientId: getParamValue('clientId', env.oidc.clientId),
      clientSecret: getParamValue('clientSecret', env.oidc.clientSecret),
      apiUrl: getParamValue('apiUrl', env.api.baseUrl),
    };

    this.loginForm = this.formBuilder.group({
      clientId: [defaultValues.clientId, [Validators.required, Validators.required]],
      clientSecret: [defaultValues.clientSecret, [Validators.required, Validators.required]],
      apiUrl: [defaultValues.apiUrl, [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    });

    // Log the source of values for debugging (only in development)
    if (this.environmentService.isDevelopment()) {
      console.log('Login form initialized with values from:', {
        fromUrl: Object.keys(queryParams).length > 0 ? queryParams : 'No URL params',
        fromEnv: 'Environment defaults used when URL params not available',
      });
    }
  }

  onApiUrlBlur(): void {
    const url = this.loginForm.get('apiUrl')?.value;
    if (url) {
      void this.detectMode(url);
    }
  }

  onLoginTabChange(index: number): void {
    this.selectedLoginMode = index === 0 ? 'sso' : 'client';
    this.syncLoginModeState();
  }

  private setClientCredentialValidators(required: boolean): void {
    const clientIdControl = this.loginForm.get('clientId');
    const clientSecretControl = this.loginForm.get('clientSecret');

    if (required) {
      clientIdControl?.setValidators([Validators.required]);
      clientSecretControl?.setValidators([Validators.required]);
    } else {
      clientIdControl?.clearValidators();
      clientSecretControl?.clearValidators();
    }

    clientIdControl?.updateValueAndValidity({ emitEvent: false });
    clientSecretControl?.updateValueAndValidity({ emitEvent: false });
  }

  private syncLoginModeState(): void {
    const requiresClientCredentials =
      this.selectedLoginMode === 'client' ||
      this.detectedMode === 'local' ||
      this.detectedMode === null;

    this.setClientCredentialValidators(requiresClientCredentials);
  }

  private async detectMode(apiUrl: string): Promise<void> {
    let normalizedUrl = apiUrl;
    while (normalizedUrl.endsWith('/')) normalizedUrl = normalizedUrl.slice(0, -1);
    this.detectedMode = 'loading';

    try {
      const discovery = await this.apiService.fetchDiscovery(normalizedUrl);

      if (discovery?.ui_client_id) {
        this.detectedMode = 'oidc';
        this.selectedLoginMode = 'sso';
        this.discoveredIssuer = discovery.issuer;
        this.discoveredUiClientId = discovery.ui_client_id;
      } else {
        this.detectedMode = 'local';
        this.selectedLoginMode = 'client';
        this.discoveredIssuer = undefined;
        this.discoveredUiClientId = undefined;
      }
    } catch {
      this.detectedMode = 'local';
      this.selectedLoginMode = 'client';
      this.discoveredIssuer = undefined;
      this.discoveredUiClientId = undefined;
    }

    this.syncLoginModeState();
  }

  get isSsoAvailable(): boolean {
    return this.detectedMode === 'oidc';
  }

  get isSsoTabDisabled(): boolean {
    return this.detectedMode === 'local';
  }

  get submitLabel(): string {
    return this.selectedLoginMode === 'sso' ? 'Login with SSO' : 'Login with Client Credentials';
  }

  get loadingLabel(): string {
    return this.selectedLoginMode === 'sso' ? 'Redirecting to SSO...' : 'Authenticating...';
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.valid) {
      this.isLoading = true;

      try {
        const formValue = this.loginForm.value;

        // Normalize the URL: remove trailing slashes
        let normalizedUrl = formValue.apiUrl;
        while (normalizedUrl.endsWith('/')) normalizedUrl = normalizedUrl.slice(0, -1);

        if (this.selectedLoginMode === 'sso') {
          const issuerUrl = this.discoveredIssuer;
          const uiClientId = this.discoveredUiClientId;

          if (!issuerUrl || !uiClientId) {
            throw new Error('OIDC mode detected but discovery metadata is incomplete.');
          }

          await this.oidcService.redirectToLogin({
            issuerUrl,
            uiClientId,
            apiUrl: normalizedUrl,
          });
          return;
        }

        await this.apiService.loginWithClientCredentials(
          formValue.clientId,
          formValue.clientSecret,
          normalizedUrl,
          this.discoveredIssuer
        );

        // Attempt to refresh/get access token
        await this.apiService.refreshAccessToken();

        this.snackBar.open('Login successful!', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar'],
        });

        // Navigate to dashboard
        this.router.navigate(['/dashboard']);
      } catch (error: any) {
        console.error('Login failed:', error);

        // Provide specific error messages based on the error type
        let errorMessage = 'Login failed. ';
        if (error?.message?.includes('fetch') || error?.name === 'TypeError') {
          errorMessage +=
            'Could not connect to EUDIPLO. Check if the instance URL is correct and the server is running.';
        } else if (error?.status === 401 || error?.message?.includes('401')) {
          errorMessage += 'Invalid credentials. Please check your Client ID and Client Secret.';
        } else if (error?.status === 404 || error?.message?.includes('404')) {
          errorMessage += 'Endpoint not found. Please verify the EUDIPLO instance URL.';
        } else {
          errorMessage += 'Please check your credentials and instance URL.';
        }

        this.snackBar.open(errorMessage, 'Close', {
          duration: 8000,
          panelClass: ['error-snackbar'],
        });
      } finally {
        this.isLoading = false;
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach((field) => {
      const control = this.loginForm.get(field);
      control?.markAsTouched({ onlySelf: true });
    });
  }

  getErrorMessage(fieldName: string): string {
    const field = this.loginForm.get(fieldName);

    if (field?.hasError('required')) {
      return `${this.getFieldDisplayName(fieldName)} is required`;
    }

    if (field?.hasError('pattern')) {
      return `${this.getFieldDisplayName(fieldName)} must be a valid URL`;
    }

    if (field?.hasError('minlength')) {
      const requiredLength = field.errors?.['minlength']?.requiredLength;
      return `${this.getFieldDisplayName(fieldName)} must be at least ${requiredLength} characters long`;
    }

    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: Record<string, string> = {
      oidcUrl: 'OIDC Discovery URL',
      clientId: 'Client ID',
      clientSecret: 'Client Secret',
      apiUrl: 'API URL',
    };
    return displayNames[fieldName] || fieldName;
  }

  toggleClientSecretVisibility(): void {
    this.hideClientSecret = !this.hideClientSecret;
  }
}
