import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import {
  TrustList,
  trustListControllerExportTrustList,
  trustListControllerGetAllTrustLists,
} from '@eudiplo/sdk-core';
import { FlexLayoutModule } from 'ngx-flexible-layout';

@Component({
  selector: 'app-trust-list-list',
  imports: [
    MatTableModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
    MatTooltipModule,
    RouterModule,
    FlexLayoutModule,
  ],
  templateUrl: './trust-list-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './trust-list-list.component.scss',
})
export class TrustListListComponent implements OnInit {
  lists: TrustList[] = [];

  displayedColumns: (keyof TrustList | 'actions')[] = ['id', 'description', 'actions'];

  constructor(private readonly snackBar: MatSnackBar) {}

  ngOnInit(): void {
    trustListControllerGetAllTrustLists().then((lists) => {
      this.lists = lists.data;
    });
  }

  async downloadConfig(list: TrustList): Promise<void> {
    try {
      const config = await trustListControllerExportTrustList({
        path: { id: list.id! },
      }).then((res) => res.data);

      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute('href', dataStr);
      downloadAnchorNode.setAttribute('download', `trustlist-${list.id}-config.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      this.snackBar.open('Trust list configuration downloaded', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error downloading config:', error);
      this.snackBar.open('Failed to download configuration', 'Close', { duration: 3000 });
    }
  }
}
