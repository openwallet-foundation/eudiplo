import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { Router } from '@angular/router';
import { ApiService } from '../../../core';

export interface SecretDialogData {
  clientId: string;
  secret: string;
  apiUrl: string;
}

@Component({
  selector: 'app-secret-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, FlexLayoutModule],
  templateUrl: './secret-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './secret-dialog.component.scss',
})
export class SecretDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SecretDialogData,
    private dialogRef: MatDialogRef<SecretDialogComponent>,
    private snackBar: MatSnackBar,
    private router: Router,
    private apiService: ApiService
  ) {}

  copySecret(): void {
    navigator.clipboard.writeText(this.data.secret).then(() => {
      this.snackBar.open('Secret copied to clipboard', 'Close', { duration: 2000 });
    });
  }

  copyAll(): void {
    const text = `Client ID: ${this.data.clientId}\nClient Secret: ${this.data.secret}`;
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Credentials copied to clipboard', 'Close', { duration: 2000 });
    });
  }

  loginAsClient(): void {
    // Logout current user
    this.apiService.logout();

    // Navigate to login with pre-filled credentials
    this.router.navigate(['/login'], {
      queryParams: {
        clientId: this.data.clientId,
        clientSecret: this.data.secret,
        apiUrl: this.data.apiUrl,
      },
    });

    this.dialogRef.close();
  }

  close(): void {
    this.dialogRef.close();
  }
}
