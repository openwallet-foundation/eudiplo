import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FieldType } from '@ngx-formly/core';
import { FormlyField, FormlyValidationMessage } from '@ngx-formly/core';

@Component({
  selector: 'app-object-type',
  template: `
    <div class="mb-3">
      @if (props.label) {
        <legend>{{ props.label }}</legend>
      }
      @if (props.description) {
        <p>{{ props.description }}</p>
      }
      @if (showError && formControl.errors) {
        <div class="alert alert-danger" role="alert">
          <formly-validation-message [field]="field"></formly-validation-message>
        </div>
      }
      @for (field of field.fieldGroup; track field.id) {
        <formly-field [field]="field"></formly-field>
      }
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [FormlyField, FormlyValidationMessage],
})
export class ObjectTypeComponent extends FieldType {}
