import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  presentationManagementControllerUpdateConfiguration,
  presentationManagementControllerReissueRegistrationCertificate,
  keyChainControllerGetAll,
  KeyChainResponseDto,
} from '@eudiplo/sdk-core';
import { PresentationManagementService } from '../presentation-management.service';
import { MatDialog } from '@angular/material/dialog';
import { JsonViewDialogComponent } from '../../../issuance/credential-config/credential-config-create/json-view-dialog/json-view-dialog.component';
import { IssuerMetadataBrowserComponent } from '../issuer-metadata-browser/issuer-metadata-browser.component';
import { SchemaMetadataBrowserComponent } from '../schema-metadata-browser/schema-metadata-browser.component';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { configs } from './pre-config';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { EditorComponent, extractSchema } from '../../../utils/editor/editor.component';
import { WebhookConfigEditComponent } from '../../../utils/webhook-config-edit/webhook-config-edit.component';
import {
  DCQLSchema,
  presentationConfigSchema,
  transactionDataArraySchema,
} from '../../../utils/schemas';
import {
  formatRegistrationCertExpiresIn,
  getRegistrationCertStatus,
} from '../../../utils/registration-cert-status';
import { CredentialIdsComponent } from '../../credential-ids/credential-ids.component';
import { RegistrarService } from '../../../registrar/registrar.service';

@Component({
  selector: 'app-presentation-create',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    RouterModule,
    MatMenuModule,
    MatDividerModule,
    MatTabsModule,
    MonacoEditorModule,
    EditorComponent,
    WebhookConfigEditComponent,
    CredentialIdsComponent,
  ],
  templateUrl: './presentation-create.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./presentation-create.component.scss'],
})
export class PresentationCreateComponent implements OnInit {
  public form: FormGroup;
  public create = true;
  public copyMode = false;
  public registrationCertTabIndex = 0;
  public registrationCertCache: any = null;
  public reissuing = false;

  DCQLSchema = DCQLSchema;

  transactionDataArraySchema = transactionDataArraySchema;

  public predefinedConfigs = configs;

  public keyChains: KeyChainResponseDto[] = [];

  readonly purposeLanguageOptions = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'de-DE', label: 'German' },
    { value: 'fr-FR', label: 'French' },
    { value: 'it-IT', label: 'Italian' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'nl-NL', label: 'Dutch' },
    { value: 'pt-PT', label: 'Portuguese' },
    { value: 'pl-PL', label: 'Polish' },
    { value: 'cs-CZ', label: 'Czech' },
    { value: 'sk-SK', label: 'Slovak' },
    { value: 'sl-SI', label: 'Slovenian' },
    { value: 'hr-HR', label: 'Croatian' },
    { value: 'hu-HU', label: 'Hungarian' },
    { value: 'ro-RO', label: 'Romanian' },
    { value: 'bg-BG', label: 'Bulgarian' },
    { value: 'el-GR', label: 'Greek' },
    { value: 'fi-FI', label: 'Finnish' },
    { value: 'sv-SE', label: 'Swedish' },
    { value: 'da-DK', label: 'Danish' },
    { value: 'et-EE', label: 'Estonian' },
    { value: 'lv-LV', label: 'Latvian' },
    { value: 'lt-LT', label: 'Lithuanian' },
    { value: 'mt-MT', label: 'Maltese' },
    { value: 'ga-IE', label: 'Irish' },
  ];

  constructor(
    private readonly presentationService: PresentationManagementService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog,
    private readonly registrarService: RegistrarService
  ) {
    this.form = new FormGroup({
      id: new FormControl(undefined, [Validators.required]),
      description: new FormControl(undefined, [Validators.required]),
      redirectUri: new FormControl(undefined),
      accessKeyChainId: new FormControl(undefined),
      dcql_query: new FormControl(undefined, [Validators.required]),
      lifeTime: new FormControl(300, [Validators.required, Validators.min(1)]),
      registrationCertImportJwt: new FormControl(undefined),
      registrationCertImportId: new FormControl(undefined),
      registrationCertBodyPrivacyPolicy: new FormControl(undefined),
      registrationCertBodySupportUri: new FormControl(undefined),
      registrationCertBodyIntermediary: new FormControl(undefined),
      registrationCertBodyPurpose: new FormArray([]),
      transaction_data: new FormControl(undefined), // Optional transaction data
      attached: new FormArray([]),
      webhook: new FormGroup({
        url: new FormControl(undefined), // Optional, but if filled, should be valid URL
        auth: new FormGroup({
          type: new FormControl(undefined), // Optional
          config: new FormGroup({
            headerName: new FormControl(undefined), // Optional
            value: new FormControl(undefined), // Optional
          }),
        }),
      }),
    });
  }

  ngOnInit(): void {
    this.loadRegistrarDefaults();

    // Load key chains for the select dropdown (filter by access usage type)
    keyChainControllerGetAll({}).then(
      (res) =>
        (this.keyChains = res.data.filter((keyChain) => keyChain.usageType === 'access') || []),
      (error) => {
        console.error('Failed to load key chains:', error);
        this.snackBar.open('Failed to load key chains', 'Close', {
          duration: 3000,
        });
      }
    );

    if (this.route.snapshot.params['id']) {
      // Check if this is a copy operation
      this.copyMode = this.route.snapshot.url.some((segment) => segment.path === 'copy');

      this.presentationService
        .getPresentationById(this.route.snapshot.params['id'])
        .then((config) => {
          if (!config) {
            this.snackBar.open('Presentation not found', 'Close', {
              duration: 3000,
            });
            this.router.navigate(['../'], { relativeTo: this.route });
            return;
          }

          // Convert dcql_query object to JSON string for form display
          const formData: any = { ...config };
          if (formData.dcql_query && typeof formData.dcql_query === 'object') {
            formData.dcql_query = JSON.stringify(formData.dcql_query, null, 2);
          }

          if (formData.registration_cert && typeof formData.registration_cert === 'object') {
            this.loadRegistrationCertIntoForm(formData.registration_cert);
            delete formData.registration_cert;
          }

          this.registrationCertCache = formData.registrationCertCache ?? null;
          delete formData.registrationCertCache;

          if (formData.transaction_data && typeof formData.transaction_data === 'object') {
            formData.transaction_data = JSON.stringify(formData.transaction_data, null, 2);
          }

          (formData.attached || []).forEach(() => this.addAttachment());

          if (this.copyMode) {
            // Copy mode: clear ID and keep it editable, set create mode
            formData.id = `${config.id}-copy`;
            this.form.patchValue(formData);
            this.create = true;
          } else {
            // Edit mode: disable ID field
            this.form.patchValue(formData);
            this.form.get('id')?.disable();
            this.create = false;
          }
        });
    }
  }

  private async loadRegistrarDefaults(): Promise<void> {
    try {
      const config = await this.registrarService.getConfig();
      const defaults = config?.registrationCertificateDefaults;
      if (!defaults || typeof defaults !== 'object') {
        return;
      }

      this.applyRegistrationCertDefaultsIfMissing(defaults as Record<string, unknown>);
    } catch {
      // Optional enhancement only; keep form functional if registrar config is unavailable.
    }
  }

  private applyRegistrationCertDefaultsIfMissing(defaults: Record<string, unknown>): void {
    const privacy =
      typeof defaults['privacy_policy'] === 'string' ? defaults['privacy_policy'].trim() : '';
    const support =
      typeof defaults['support_uri'] === 'string' ? defaults['support_uri'].trim() : '';
    const intermediary =
      typeof defaults['intermediary'] === 'string' ? defaults['intermediary'].trim() : '';

    const privacyCtrl = this.form.get('registrationCertBodyPrivacyPolicy');
    const supportCtrl = this.form.get('registrationCertBodySupportUri');
    const intermediaryCtrl = this.form.get('registrationCertBodyIntermediary');

    const currentPrivacy = `${privacyCtrl?.value ?? ''}`.trim();
    const currentSupport = `${supportCtrl?.value ?? ''}`.trim();
    const currentIntermediary = `${intermediaryCtrl?.value ?? ''}`.trim();

    if (!currentPrivacy && privacy) {
      privacyCtrl?.setValue(privacy);
    }
    if (!currentSupport && support) {
      supportCtrl?.setValue(support);
    }
    if (!currentIntermediary && intermediary) {
      intermediaryCtrl?.setValue(intermediary);
    }
  }

  getFormArray(value: string) {
    return this.form.get(value) as FormArray;
  }

  addAttachment(): void {
    this.getFormArray('attached').push(
      new FormGroup({
        format: new FormControl(undefined, [Validators.required]),
        data: new FormControl(undefined, [Validators.required]),
        credential_ids: new FormControl(),
      })
    );
  }

  removeAttachment(index: number) {
    (this.form.get('attached') as FormArray).removeAt(index);
  }

  getFormGroup(value: string) {
    return this.form.get(value) as FormGroup;
  }

  asFormGroup(value: any) {
    return value as FormGroup;
  }

  createOrUpdatePresentation(): void {
    // Parse the JSON string to an object for dcql_query
    const formValue = { ...this.form.value };

    // Convert dcql_query from string to object
    if (formValue.dcql_query) {
      try {
        formValue.dcql_query = extractSchema(formValue.dcql_query);
        formValue.transaction_data = extractSchema(formValue.transaction_data);
      } catch (error) {
        console.error('Error parsing DCQL Query JSON:', error);
        return;
      }
    }

    formValue.registration_cert = this.buildRegistrationCertFromForm();

    if (!formValue.webhook.url) {
      formValue.webhook = null; // Set to null to clear the webhook
    }

    if (!formValue.registration_cert) {
      formValue.registration_cert = null; // Set to null to clear registration_cert
    }

    if (!formValue.transaction_data) {
      formValue.transaction_data = null; // Set to null to clear transaction_data
    }

    // In copy mode or new creation, use form ID; in edit mode, use route param ID
    if (!this.copyMode && this.route.snapshot.params['id']) {
      formValue.id = this.route.snapshot.params['id'];
    }

    if (this.create) {
      this.presentationService.createConfiguration(formValue).then(
        (res: any) => {
          // In copy mode, navigate up two levels (past :id/copy), otherwise one level
          const navigatePath = this.copyMode ? ['../../', res.id] : ['../', res.id];
          this.router.navigate(navigatePath, { relativeTo: this.route });
          this.snackBar.open('Presentation created successfully', 'Close', {
            duration: 3000,
          });
        },
        (err: any) => this.snackBar.open(err.message, 'Close')
      );
    } else {
      presentationManagementControllerUpdateConfiguration({
        body: formValue,
        path: { id: formValue.id },
      }).then(
        () => {
          this.router.navigate(['../'], { relativeTo: this.route });
          this.snackBar.open('Presentation updated successfully', 'Close', {
            duration: 3000,
          });
        },
        (err: any) => {
          this.snackBar.open(err.message, 'Close');
        }
      );
    }
  }

  // Helper method to format JSON for display
  formatJson(): void {
    const dcqlControl = this.form.get('dcql_query');
    if (dcqlControl?.value) {
      try {
        const parsed = JSON.parse(dcqlControl.value);
        const formatted = JSON.stringify(parsed, null, 2);
        dcqlControl.setValue(formatted);
      } catch {
        // Invalid JSON, don't format
      }
    }
  }

  /**
   * Show/Edit the entire presentation config as JSON
   */
  viewAsJson(): void {
    const currentConfig = this.getCompleteConfiguration();
    const dialogRef = this.dialog.open(JsonViewDialogComponent, {
      data: {
        title: 'Presentation Configuration JSON',
        jsonData: currentConfig,
        readonly: false,
        schema: presentationConfigSchema,
      },
      disableClose: true,
      minWidth: '60vw',
      maxWidth: '95vw',
      maxHeight: '95vh',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadConfigurationFromJson(result);
      }
    });
  }

  /**
   * Get the complete config object from form values
   */
  private getCompleteConfiguration(): any {
    const formValue = { ...this.form.getRawValue() };

    delete formValue.registrationCertImportJwt;
    delete formValue.registrationCertImportId;
    delete formValue.registrationCertBodyPrivacyPolicy;
    delete formValue.registrationCertBodySupportUri;
    delete formValue.registrationCertBodyIntermediary;
    delete formValue.registrationCertBodyPurpose;

    // Parse dcql_query if it's a string
    if (formValue.dcql_query && typeof formValue.dcql_query === 'string') {
      try {
        formValue.dcql_query = extractSchema(formValue.dcql_query);
      } catch {
        // Ignore JSON parse errors
      }
    }

    if (formValue.transaction_data && typeof formValue.transaction_data === 'string') {
      try {
        formValue.transaction_data = extractSchema(formValue.transaction_data);
      } catch {
        // Ignore JSON parse errors
      }
    }

    formValue.registration_cert = this.getExportRegistrationCert();
    if (!formValue.webhook?.url) {
      formValue.webhook = undefined;
    }
    if (!formValue.registration_cert) {
      formValue.registration_cert = undefined; // Remove registrationCert if not provided
    }

    if (!formValue.redirectUri) {
      formValue.redirectUri = undefined;
    }

    if (!formValue.accessKeyChainId) {
      formValue.accessKeyChainId = undefined;
    }

    if (
      formValue.transaction_data == null ||
      (Array.isArray(formValue.transaction_data) && formValue.transaction_data.length === 0) ||
      formValue.transaction_data === ''
    ) {
      formValue.transaction_data = undefined;
    }

    // Clean up empty optional fields
    if (formValue.attached?.length === 0) {
      formValue.attached = undefined;
    }
    return formValue;
  }

  private getExportRegistrationCert(): any {
    const body = this.getRegistrationCertBodyFromForm();
    const importId = `${this.form.get('registrationCertImportId')?.value ?? ''}`.trim();
    const cachedJwt = this.registrationCertCache?.jwt;
    if (typeof cachedJwt === 'string' && cachedJwt.trim().length > 0) {
      return {
        ...(body ? { body } : {}),
        ...(importId ? { id: importId } : {}),
        jwt: cachedJwt.trim(),
      };
    }

    return this.buildRegistrationCertFromForm();
  }

  private getRegistrationCertBodyFromForm(): any {
    const purpose = this.registrationCertPurposeArray.controls
      .map((ctrl) => ({
        lang: ctrl.get('lang')?.value?.trim(),
        content: ctrl.get('content')?.value?.trim(),
      }))
      .filter((entry) => entry.lang && entry.content);

    if (purpose.length === 0) {
      return null;
    }

    const privacyPolicy = this.form.get('registrationCertBodyPrivacyPolicy')?.value?.trim();
    const supportUri = this.form.get('registrationCertBodySupportUri')?.value?.trim();
    const intermediary = this.form.get('registrationCertBodyIntermediary')?.value?.trim();

    const body: any = { purpose };
    if (privacyPolicy) {
      body.privacy_policy = privacyPolicy;
    }
    if (supportUri) {
      body.support_uri = supportUri;
    }
    if (intermediary) {
      body.intermediary = intermediary;
    }

    return body;
  }

  /**
   * Load a predefined configuration
   */
  loadPredefinedConfig(configTemplate: any): void {
    console.log(configTemplate);
    const config = structuredClone(configTemplate.config); // Deep clone

    this.loadConfigurationFromJson(config);

    this.snackBar.open(`${configTemplate.name} template loaded successfully`, 'OK', {
      duration: 3000,
    });
  }

  /**
   * Show predefined configuration in JSON view (readonly)
   */
  previewPredefinedConfig(configTemplate: any): void {
    this.dialog.open(JsonViewDialogComponent, {
      data: {
        title: `${configTemplate.name} - Preview`,
        jsonData: configTemplate.config,
        readonly: true,
      },
      disableClose: false,
      maxWidth: '95vw',
      maxHeight: '95vh',
    });
  }

  /**
   * Import config from JSON and update the form
   */
  private loadConfigurationFromJson(config: any): void {
    try {
      const formData: any = { ...config };
      if (formData.dcql_query) {
        formData.dcql_query = extractSchema(formData.dcql_query);
      }
      if (formData.registration_cert) {
        this.loadRegistrationCertIntoForm(extractSchema(formData.registration_cert));
        delete formData.registration_cert;
      }

      this.form.patchValue(formData);
      this.snackBar.open('Configuration loaded from JSON successfully', 'OK', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error loading configuration from JSON:', error);
      this.snackBar.open('Error loading configuration from JSON', 'Close', {
        duration: 3000,
      });
    }
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.snackBar.open(`${label} copied to clipboard!`, 'OK', {
        duration: 2000,
        panelClass: ['success-snackbar'],
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
      this.snackBar.open(`Failed to copy ${label}`, 'OK', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Open the issuer metadata browser dialog to import DCQL from an issuer
   */
  importFromIssuer(): void {
    const dialogRef = this.dialog.open(IssuerMetadataBrowserComponent, {
      data: {},
      disableClose: false,
      minWidth: '60vw',
      maxWidth: '95vw',
      maxHeight: '95vh',
    });

    dialogRef.afterClosed().subscribe((dcqlQuery) => {
      if (dcqlQuery) {
        // Set the DCQL query in the form
        this.form.get('dcql_query')?.setValue(JSON.stringify(dcqlQuery, null, 2));
        this.snackBar.open('DCQL query imported from issuer', 'OK', {
          duration: 3000,
        });
      }
    });
  }

  /**
   * Open the schema metadata browser dialog to import DCQL from schema metadata.
   */
  importFromSchemaMetadata(): void {
    const dialogRef = this.dialog.open(SchemaMetadataBrowserComponent, {
      data: {},
      disableClose: false,
      minWidth: '60vw',
      maxWidth: '95vw',
      maxHeight: '95vh',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const dcqlQuery = result.dcqlQuery ? result.dcqlQuery : result;
        this.form.get('dcql_query')?.setValue(JSON.stringify(dcqlQuery, null, 2));

        const idControl = this.form.get('id');
        const descriptionControl = this.form.get('description');

        const currentId = `${idControl?.value ?? ''}`.trim();
        const currentDescription = `${descriptionControl?.value ?? ''}`.trim();

        if (!currentId && typeof result.suggestedPresentationId === 'string') {
          idControl?.setValue(result.suggestedPresentationId);
        }

        if (!currentDescription && typeof result.suggestedDescription === 'string') {
          descriptionControl?.setValue(result.suggestedDescription);
        }

        this.snackBar.open('DCQL query imported from schema metadata', 'OK', {
          duration: 3000,
        });
      }
    });
  }

  get registrationCertPurposeArray(): FormArray {
    return this.form.get('registrationCertBodyPurpose') as FormArray;
  }

  addRegistrationCertPurpose(lang = 'en-US', value = ''): void {
    const normalizedLang = this.purposeLanguageOptions.some((option) => option.value === lang)
      ? lang
      : 'en-US';

    this.registrationCertPurposeArray.push(
      new FormGroup({
        lang: new FormControl(normalizedLang, [Validators.required]),
        content: new FormControl(value, [Validators.required]),
      })
    );
  }

  removeRegistrationCertPurpose(index: number): void {
    this.registrationCertPurposeArray.removeAt(index);
  }

  /**
   * Status of the persisted registration-certificate cache for the loaded
   * presentation config. The backend invalidates this cache automatically
   * when the registrationCert spec or dcql_query change, so a `null` cache
   * after editing those fields means a fresh issuance is pending.
   */
  get registrationCertStatus(): 'none' | 'active' | 'expiring' | 'expired' | 'pending' {
    if (this.create) return 'none';
    return getRegistrationCertStatus({
      registration_cert: this.buildRegistrationCertFromForm() as any,
      registrationCertCache: this.registrationCertCache,
    });
  }

  get registrationCertExpiresIn(): string | null {
    return formatRegistrationCertExpiresIn(this.registrationCertCache);
  }

  reissueRegistrationCert(): void {
    const id = this.route.snapshot.params['id'];
    if (!id || this.create) return;
    this.reissuing = true;
    presentationManagementControllerReissueRegistrationCertificate({
      path: { id },
    })
      .then((res: any) => {
        this.registrationCertCache = res?.data?.registrationCertCache ?? null;
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

  private buildRegistrationCertFromForm(): any {
    if (this.registrationCertTabIndex === 0) {
      const jwt = this.form.get('registrationCertImportJwt')?.value?.trim();
      const id = this.form.get('registrationCertImportId')?.value?.trim();

      if (jwt) {
        return { jwt };
      }

      if (id) {
        return { id };
      }

      return null;
    }

    const body = this.getRegistrationCertBodyFromForm();
    if (!body) {
      return null;
    }

    return { body };
  }

  private loadRegistrationCertIntoForm(registrationCert: any): void {
    this.form.patchValue({
      registrationCertImportJwt: registrationCert?.jwt ?? undefined,
      registrationCertImportId: registrationCert?.id ?? undefined,
      registrationCertBodyPrivacyPolicy: registrationCert?.body?.privacy_policy ?? undefined,
      registrationCertBodySupportUri: registrationCert?.body?.support_uri ?? undefined,
      registrationCertBodyIntermediary: registrationCert?.body?.intermediary ?? undefined,
    });

    while (this.registrationCertPurposeArray.length > 0) {
      this.registrationCertPurposeArray.removeAt(0);
    }

    const purposes = Array.isArray(registrationCert?.body?.purpose)
      ? registrationCert.body.purpose
      : [];

    for (const purpose of purposes) {
      this.addRegistrationCertPurpose(
        purpose?.lang || '',
        purpose?.content || purpose?.value || ''
      );
    }

    if (registrationCert?.jwt || registrationCert?.id) {
      this.registrationCertTabIndex = 0;
      return;
    }

    if (registrationCert?.body) {
      this.registrationCertTabIndex = 1;
    }
  }
}
