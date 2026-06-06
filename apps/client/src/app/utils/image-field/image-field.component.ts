import { Component, Input, ElementRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { storageControllerUpload } from '@eudiplo/sdk-core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-image-field',
  imports: [
    ReactiveFormsModule,
    MatInputModule,
    MatIconModule,
    MatSnackBarModule,
    FlexLayoutModule,
    MatButtonModule,
  ],
  templateUrl: './image-field.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./image-field.component.scss'],
})
export class ImageFieldComponent {
  @Input() field!: FormControl<string>;
  @Input() label!: string;
  @Input() required = false;
  @ViewChild('logoFileInput') logoFileInput!: ElementRef<HTMLInputElement>;

  constructor(private snackBar: MatSnackBar) {}

  triggerLogoFileInput() {
    this.logoFileInput.nativeElement.click();
  }

  uploadLogoFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    storageControllerUpload({ body: { file } })
      .then((response: any) => {
        const url = response.url || response.data?.url;
        this.field.setValue(url);
        this.snackBar.open('Logo uploaded!', 'Close', { duration: 2000 });
      })
      .catch((error: any) => {
        this.snackBar.open(`Upload failed: ${error.message}`, 'Close', { duration: 3000 });
      });
  }
}
