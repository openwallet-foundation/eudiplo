import { CommonModule } from '@angular/common';
import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from 'ngx-flexible-layout';

export interface UserTemporaryPasswordDialogData {
  username: string;
  temporaryPassword: string;
}

@Component({
  selector: 'app-user-temporary-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, FlexLayoutModule],
  templateUrl: './user-temporary-password-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-temporary-password-dialog.component.scss',
})
export class UserTemporaryPasswordDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: UserTemporaryPasswordDialogData,
    private dialogRef: MatDialogRef<UserTemporaryPasswordDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  copyPassword(): void {
    navigator.clipboard.writeText(this.data.temporaryPassword).then(() => {
      this.snackBar.open('Temporary password copied to clipboard', 'Close', { duration: 2000 });
    });
  }

  copyAll(): void {
    const text = `Username: ${this.data.username}\nTemporary Password: ${this.data.temporaryPassword}`;
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Login details copied to clipboard', 'Close', { duration: 2000 });
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
