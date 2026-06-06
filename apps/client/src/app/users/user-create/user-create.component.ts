import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type FormGroup } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  userControllerCreateUser,
  userControllerGetUser,
  userControllerUpdateUser,
} from '@eudiplo/sdk-core';
import { JwtService, roles } from '../../services/jwt.service';
import { UserTemporaryPasswordDialogComponent } from '../user-temporary-password-dialog/user-temporary-password-dialog.component';

@Component({
  selector: 'app-user-create',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FlexLayoutModule,
    MatSelectModule,
    RouterModule,
    MatTooltipModule,
    MatCheckboxModule,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './user-create.component.html',
})
export class UserCreateComponent implements OnInit {
  private readonly jwtService = inject(JwtService);

  userForm: FormGroup;
  isSubmitting = false;
  availableRoles = roles;
  loaded = false;
  id?: string | null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(1)]],
      enabled: [true],
      roles: [[], [Validators.required]],
    });

    if (!this.jwtService.hasRole('tenants:manage')) {
      this.availableRoles = roles.filter((r) => r !== 'tenants:manage');
    }
  }

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id');
    if (this.id) {
      this.loaded = true;
      userControllerGetUser({ path: { id: this.id } }).then((res) => {
        if (!res.data) {
          this.snackBar.open('User not found', 'Close', { duration: 3000 });
          this.router.navigate(['../..'], { relativeTo: this.route });
          return;
        }

        this.userForm.patchValue(res.data);
        this.userForm.get('username')?.disable();
      });
    }
  }

  async onSubmit(): Promise<void> {
    this.isSubmitting = true;

    try {
      const payload = this.userForm.getRawValue();

      if (this.loaded) {
        await userControllerUpdateUser({
          path: { id: this.id! },
          body: payload,
        });
        this.snackBar.open('User updated successfully', 'Close', { duration: 3000 });
        await this.router.navigate(['..'], { relativeTo: this.route });
      } else {
        const response = await userControllerCreateUser({ body: payload });
        const temporaryPassword = response.data?.temporaryPassword;
        if (temporaryPassword) {
          const dialogRef = this.dialog.open(UserTemporaryPasswordDialogComponent, {
            data: {
              username: response.data?.username || payload.username,
              temporaryPassword,
            },
            width: '500px',
            disableClose: true,
          });

          dialogRef.afterClosed().subscribe(() => {
            this.router.navigate(['..'], { relativeTo: this.route });
          });
        } else {
          this.snackBar.open('User created successfully', 'Close', { duration: 3000 });
          await this.router.navigate(['..'], { relativeTo: this.route });
        }
      }
    } catch (error) {
      this.snackBar.open(
        error instanceof Error
          ? error.message
          : `Failed to ${this.loaded ? 'update' : 'create'} user`,
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
