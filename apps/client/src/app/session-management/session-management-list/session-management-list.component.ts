import { SelectionModel } from '@angular/cdk/collections';
import { CommonModule } from '@angular/common';
import { Component, ViewChild, AfterViewInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { FlexLayoutModule } from 'ngx-flexible-layout';
import { Session } from '@eudiplo/sdk-core';
import { from, merge, of as observableOf, Subject } from 'rxjs';
import { catchError, startWith, switchMap } from 'rxjs/operators';
import { SessionManagementService } from '../session-management.service';

// Define the SessionStatus type
export type SessionStatus = 'active' | 'fetched' | 'completed' | 'expired' | 'failed';

@Component({
  selector: 'app-session-management-list',
  imports: [
    MatTableModule,
    MatSortModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCardModule,
    MatTooltipModule,
    MatCheckboxModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RouterModule,
    FlexLayoutModule,
    ReactiveFormsModule,
    MatPaginatorModule,
  ],
  templateUrl: './session-management-list.component.html',
  styleUrl: './session-management-list.component.scss',
})
export class SessionManagementListComponent implements AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  dataSource = new MatTableDataSource<Session>([]);
  typeFilter = new FormControl<'all' | 'issuance' | 'presentation'>('all');
  statusFilter = new FormControl<'all' | SessionStatus>('all');
  selection = new SelectionModel<Session>(true, []);

  totalItems = 0;
  pageSize = 25;
  pageSizeOptions = [10, 25, 50, 100];
  isLoadingResults = true;

  displayedColumns: (keyof Session | 'select' | 'type' | 'actions')[] = [
    'select',
    'id',
    'type',
    'status',
    'createdAt',
    'actions',
  ];

  typeOptions = [
    { value: 'all', label: 'All Sessions' },
    { value: 'issuance', label: 'Issuance Sessions' },
    { value: 'presentation', label: 'Presentation Sessions' },
  ];

  statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'fetched', label: 'Fetched' },
    { value: 'completed', label: 'Completed' },
    { value: 'expired', label: 'Expired' },
    { value: 'failed', label: 'Failed' },
  ];

  deletingSelected = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new Subject<void>();

  constructor(private sessionManagementService: SessionManagementService) {}

  ngAfterViewInit(): void {
    // Reset to page 1 when sort or filters change
    merge(this.sort.sortChange, this.typeFilter.valueChanges, this.statusFilter.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => (this.paginator.pageIndex = 0));

    // Reload data on any triggering event (sort, page change, filter change, manual refresh)
    merge(
      this.sort.sortChange,
      this.paginator.page,
      this.typeFilter.valueChanges,
      this.statusFilter.valueChanges,
      this.refresh$
    )
      .pipe(
        startWith({}),
        switchMap(() => {
          this.isLoadingResults = true;
          const typeValue = this.typeFilter.value;
          const statusValue = this.statusFilter.value;
          // Map the 'type' column sort to its underlying DB field 'requestId'
          const sortActive = this.sort.active === 'type' ? 'requestId' : this.sort.active;
          const sortDirection = this.sort.direction;
          return from(
            this.sessionManagementService.getAllSessions({
              page: this.paginator.pageIndex + 1,
              pageSize: this.paginator.pageSize,
              ...(typeValue !== 'all' && typeValue ? { type: typeValue } : {}),
              ...(statusValue !== 'all' && statusValue ? { status: statusValue } : {}),
              ...(sortActive && sortDirection
                ? {
                    sortBy: sortActive as 'id' | 'status' | 'createdAt' | 'requestId',
                    sortOrder: sortDirection,
                  }
                : {}),
            })
          ).pipe(catchError(() => observableOf(null)));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((result) => {
        this.isLoadingResults = false;
        if (result) {
          this.dataSource.data = result.items;
          this.totalItems = result.total;
          this.selection.clear();
        }
      });
  }

  refreshSessions(): void {
    this.refresh$.next();
  }

  // Selection methods
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  masterToggle() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource.data);
  }

  checkboxLabel(row?: Session): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id}`;
  }

  async deleteSelectedSessions() {
    if (this.selection.selected.length === 0) {
      return;
    }

    const selectedSessions = [...this.selection.selected]; // Create a copy
    const selectedCount = selectedSessions.length;

    this.deletingSelected = true;
    try {
      // Delete each selected session
      const deletePromises = selectedSessions.map((session) =>
        this.sessionManagementService.deleteSession(session.id)
      );

      await Promise.all(deletePromises);

      // Clear selection and refresh the list
      this.selection.clear();
      await this.refreshSessions();

      // You can add a snackbar notification here if you have it set up
      console.log(`Successfully deleted ${selectedCount} sessions`);
    } catch (error) {
      console.error('Error deleting sessions:', error);
      // You can add error notification here
    } finally {
      this.deletingSelected = false;
    }
  }

  clearSelection() {
    this.selection.clear();
  }

  getSessionStatus(session: Session): SessionStatus {
    return session.status as SessionStatus;
  }

  getStatusDisplay(status: any): string {
    return this.sessionManagementService.getStatusDisplay(status);
  }

  getStatusClass(status: any): string {
    return 'status-' + (status as SessionStatus);
  }
}
