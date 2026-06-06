import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ManagedUserDto, userControllerDeleteUser, userControllerGetUser } from '@eudiplo/sdk-core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-user-show',
  imports: [
    MatSnackBarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    FlexLayoutModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './user-show.component.html',
})
export class UserShowComponent implements OnInit {
  user?: ManagedUserDto;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('id')!;
    userControllerGetUser({ path: { id: userId } }).then(
      (user) => (this.user = user.data),
      (err) => {
        this.snackBar.open(
          'Failed to load user: ' + (err instanceof Error ? err.message : ''),
          'Close',
          { duration: 5000 }
        );
        this.router.navigate(['..'], { relativeTo: this.route });
      }
    );
  }

  async deleteUser(): Promise<void> {
    if (
      !this.user?.id ||
      !confirm(`Are you sure you want to delete user "${this.user.username}"?`)
    ) {
      return;
    }

    try {
      await userControllerDeleteUser({ path: { id: this.user.id } });
      this.snackBar.open('User deleted successfully', 'Close', { duration: 3000 });
      await this.router.navigate(['../'], { relativeTo: this.route });
    } catch (error) {
      console.error('Error deleting user:', error);
      this.snackBar.open('Failed to delete user', 'Close', { duration: 3000 });
    }
  }
}
