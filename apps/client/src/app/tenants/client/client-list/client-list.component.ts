import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import {
  clientControllerGetClients,
  ClientEntity,
  clientControllerDeleteClient,
  clientControllerRotateClientSecret,
} from '@eudiplo/sdk-core';
import { ApiService } from '../../../core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SecretDialogComponent } from '../secret-dialog/secret-dialog.component';

@Component({
  selector: 'app-client-list',
  imports: [
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    RouterModule,
    FlexLayoutModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './client-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './client-list.component.scss',
})
export class ClientListComponent implements OnInit {
  @Input() loadedClients?: ClientEntity[];

  clients: ClientEntity[] = [];
  loading = false;
  hasPermission = false;

  displayedColumns: (keyof ClientEntity | 'actions')[] = [
    'clientId',
    'description',
    'roles',
    'actions',
  ];

  constructor(
    private readonly snackBar: MatSnackBar,
    private readonly apiService: ApiService,
    private readonly router: Router,
    private readonly dialog: MatDialog
  ) {}
  ngOnInit(): void {
    if (this.loadedClients) {
      this.clients = this.loadedClients;
    } else {
      this.loadClients();
    }
  }

  async loadClients(): Promise<void> {
    this.loading = true;
    try {
      this.clients = await clientControllerGetClients<true>().then((res) => res.data);
    } catch (error) {
      console.error('Error loading clients:', error);
      this.snackBar.open('Failed to load clients', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  async deleteClient(client: ClientEntity): Promise<void> {
    if (
      !client.clientId ||
      !confirm(`Are you sure you want to delete client "${client.clientId}"?`)
    ) {
      return;
    }

    try {
      await clientControllerDeleteClient({ path: { id: client.clientId } });
      await this.loadClients(); // Reload the list
      this.snackBar.open('Client deleted successfully', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error deleting client:', error);
      this.snackBar.open('Failed to delete client', 'Close', { duration: 3000 });
    }
  }

  /**
   * Rotate (regenerate) a client's secret.
   * Shows the new secret in a dialog for one-time viewing.
   */
  async rotateSecret(client: ClientEntity): Promise<void> {
    if (
      !confirm(
        `Are you sure you want to rotate the secret for "${client.clientId}"?\n\nThe current secret will be invalidated immediately. Make sure to save the new secret - you won't be able to see it again!`
      )
    ) {
      return;
    }

    try {
      const result = await clientControllerRotateClientSecret({
        path: { id: client.clientId },
      });

      if (result.data?.secret) {
        this.dialog.open(SecretDialogComponent, {
          data: {
            clientId: client.clientId,
            secret: result.data.secret,
            apiUrl: this.apiService.getBaseUrl(),
          },
          width: '500px',
          disableClose: true,
        });
      }
    } catch (error) {
      console.error('Error rotating secret:', error);
      this.snackBar.open('Failed to rotate client secret', 'Close', { duration: 3000 });
    }
  }
}
