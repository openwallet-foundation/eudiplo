import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { clientControllerGetClient, ClientEntity } from '@eudiplo/sdk-core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { MatChipsModule } from '@angular/material/chips';

@Component({
  selector: 'app-client-show',
  imports: [
    MatSnackBarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    FlexLayoutModule,
    MatChipsModule,
  ],
  templateUrl: './client-show.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './client-show.component.scss',
})
export class ClientShowComponent implements OnInit {
  client?: ClientEntity;
  constructor(
    private readonly route: ActivatedRoute,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit() {
    const clientId = this.route.snapshot.paramMap.get('id')!;
    clientControllerGetClient({ path: { id: clientId } }).then(
      (client) => (this.client = client.data),
      (err) => {
        this.snackBar.open(
          'Failed to load client: ' + (err instanceof Error ? err.message : ''),
          'Close',
          { duration: 5000 }
        );
        this.router.navigate(['..'], { relativeTo: this.route });
      }
    );
  }
}
