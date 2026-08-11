import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  ManagedUserDto,
  userControllerDeleteUser,
  userControllerGetUsers,
} from '@eudiplo/sdk-core';

@Component({
  selector: 'app-user-list',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    RouterModule,
    FlexLayoutModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  users: ManagedUserDto[] = [];
  loading = false;
  isUnavailable = false;
  unavailableMessage = '';
  displayedColumns: (keyof ManagedUserDto | 'actions')[] = [
    'username',
    'roles',
    'enabled',
    'actions',
  ];

  constructor(private readonly snackBar: MatSnackBar) {}

  ngOnInit(): void {
    void this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    this.isUnavailable = false;
    this.unavailableMessage = '';

    try {
      this.users = await userControllerGetUsers<true>().then((res) => res.data);
    } catch (error) {
      const message = this.getErrorMessage(error);

      if (this.isUnavailableError(message, error)) {
        this.isUnavailable = true;
        this.unavailableMessage = message;
        this.users = [];
      } else {
        console.error('Error loading users:', error);
        this.snackBar.open('Failed to load users', 'Close', { duration: 3000 });
      }
    } finally {
      this.loading = false;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const maybeMessage = (error as { message?: unknown }).message;
      if (typeof maybeMessage === 'string') {
        return maybeMessage;
      }

      const maybeBody = (error as { body?: unknown }).body;
      if (typeof maybeBody === 'string') {
        return maybeBody;
      }

      if (typeof maybeBody === 'object' && maybeBody !== null) {
        const bodyMessage = (maybeBody as { message?: unknown }).message;
        if (typeof bodyMessage === 'string') {
          return bodyMessage;
        }
      }
    }

    return 'Failed to load users';
  }

  private isUnavailableError(message: string, error: unknown): boolean {
    const errorText = `${message} ${this.getErrorDetails(error)}`.toLowerCase();

    return (
      errorText.includes('human user management') ||
      errorText.includes('external oidc provider') ||
      errorText.includes('not implemented') ||
      (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 501)
    );
  }

  private getErrorDetails(error: unknown): string {
    if (typeof error !== 'object' || error === null) {
      return '';
    }

    const maybeBody = (error as { body?: unknown }).body;
    if (typeof maybeBody === 'string') {
      return maybeBody;
    }

    if (typeof maybeBody === 'object' && maybeBody !== null) {
      const bodyText = JSON.stringify(maybeBody);
      return bodyText;
    }

    return '';
  }

  async deleteUser(user: ManagedUserDto): Promise<void> {
    if (!user.id || !confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    try {
      await userControllerDeleteUser({ path: { id: user.id } });
      await this.loadUsers();
      this.snackBar.open('User deleted successfully', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error deleting user:', error);
      this.snackBar.open('Failed to delete user', 'Close', { duration: 3000 });
    }
  }
}
