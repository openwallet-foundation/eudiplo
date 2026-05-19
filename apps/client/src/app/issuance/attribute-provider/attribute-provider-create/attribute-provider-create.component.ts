import { Component, type OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { AttributeProviderService } from '../attribute-provider.service';
import { JsonViewDialogComponent } from '../../credential-config/credential-config-create/json-view-dialog/json-view-dialog.component';
import { buildAuthConfig, toAuthFormValue } from '../../../common/auth-display.util';
import { webhookSchema } from '../../../utils/schemas';

@Component({
  selector: 'app-attribute-provider-create',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDialogModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './attribute-provider-create.component.html',
  styleUrl: './attribute-provider-create.component.scss',
})
export class AttributeProviderCreateComponent implements OnInit {
  form: FormGroup;
  create = true;

  constructor(
    private readonly attributeProviderService: AttributeProviderService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly dialog: MatDialog
  ) {
    this.form = new FormGroup({
      id: new FormControl('', [Validators.required]),
      name: new FormControl('', [Validators.required]),
      description: new FormControl(''),
      url: new FormControl('', [Validators.required]),
      authType: new FormControl('none', [Validators.required]),
      authHeaderName: new FormControl(''),
      authHeaderValue: new FormControl(''),
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.create = false;
      this.attributeProviderService.getById(id).then(
        (provider) => {
          const authFormValue = toAuthFormValue(provider.auth as any);
          this.form.patchValue({
            id: provider.id,
            name: provider.name,
            description: provider.description || '',
            url: provider.url,
            ...authFormValue,
          });
          this.form.get('id')?.disable();
        },
        (error) => {
          this.snackBar.open('Failed to load attribute provider', 'Close', { duration: 3000 });
          console.error('Load error:', error);
        }
      );
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();
    const auth = buildAuthConfig({
      authType: formValue.authType,
      authHeaderName: formValue.authHeaderName,
      authHeaderValue: formValue.authHeaderValue,
    });

    if (this.create) {
      this.attributeProviderService
        .create({
          id: formValue.id,
          name: formValue.name,
          description: formValue.description || undefined,
          url: formValue.url,
          auth,
        })
        .then(() => {
          this.snackBar.open('Attribute provider created successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['../'], { relativeTo: this.route });
        })
        .catch((error) => {
          this.snackBar.open('Failed to create attribute provider', 'Close', { duration: 3000 });
          console.error('Create error:', error);
        });
    } else {
      const id = this.route.snapshot.paramMap.get('id')!;
      this.attributeProviderService
        .update(id, {
          name: formValue.name,
          description: formValue.description || undefined,
          url: formValue.url,
          auth,
        })
        .then(() => {
          this.snackBar.open('Attribute provider updated successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['../../', id], { relativeTo: this.route });
        })
        .catch((error) => {
          this.snackBar.open('Failed to update attribute provider', 'Close', { duration: 3000 });
          console.error('Update error:', error);
        });
    }
  }

  viewAsJson(): void {
    const payload = this.buildPayload();
    const dialogRef = this.dialog.open(JsonViewDialogComponent, {
      data: {
        title: 'Attribute Provider JSON',
        jsonData: payload,
        readonly: false,
        schema: webhookSchema,
      },
      disableClose: true,
      minWidth: '60vw',
      maxWidth: '95vw',
      maxHeight: '95vh',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadFromJson(result);
      }
    });
  }

  private buildPayload(): any {
    const formValue = this.form.getRawValue();
    const auth = buildAuthConfig({
      authType: formValue.authType,
      authHeaderName: formValue.authHeaderName,
      authHeaderValue: formValue.authHeaderValue,
    });
    return {
      id: formValue.id,
      name: formValue.name,
      description: formValue.description || undefined,
      url: formValue.url,
      auth,
    };
  }

  private loadFromJson(json: any): void {
    const authFormValue = toAuthFormValue(json.auth);
    this.form.patchValue({
      id: json.id || '',
      name: json.name || '',
      description: json.description || '',
      url: json.url || '',
      ...authFormValue,
    });
  }
}
