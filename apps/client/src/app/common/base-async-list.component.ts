import { Directive, OnInit } from '@angular/core';

@Directive()
export abstract class BaseAsyncListComponent<T> implements OnInit {
  protected items: T[] = [];

  ngOnInit(): void {
    void this.loadItems();
  }

  protected abstract fetchItems(): Promise<T[]>;

  private async loadItems(): Promise<void> {
    this.items = await this.fetchItems();
  }
}
