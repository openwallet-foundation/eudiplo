import {
  ChangeDetectorRef,
  Directive,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnInit,
} from '@angular/core';
import { ConfigOwnershipService, ConfigResourceKind } from './config-ownership.service';

@Directive({
  selector: '[appConfigManaged]',
  standalone: true,
})
export class ConfigOwnershipDirective implements OnInit, OnChanges {
  @Input({ required: true }) managedKind!: ConfigResourceKind;
  @Input({ required: true }) managedResourceId = '';

  managed = false;
  @HostBinding('attr.aria-disabled') get ariaDisabled(): string | null {
    return this.managed ? 'true' : null;
  }
  @HostBinding('attr.tabindex') get tabIndex(): string | null {
    return this.managed ? '-1' : null;
  }
  @HostBinding('class.config-managed-action') get managedClass(): boolean {
    return this.managed;
  }
  @HostBinding('style.pointer-events') get pointerEvents(): string | null {
    return this.managed ? 'none' : null;
  }
  @HostBinding('style.opacity') get opacity(): string | null {
    return this.managed ? '0.38' : null;
  }

  private request = 0;

  constructor(
    private readonly ownership: ConfigOwnershipService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.refresh();
  }

  ngOnChanges(): void {
    void this.refresh();
  }

  @HostListener('click', ['$event'])
  preventManagedMutation(event: Event): void {
    if (!this.managed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private async refresh(): Promise<void> {
    const request = ++this.request;
    if (!this.managedKind || !this.managedResourceId) {
      this.managed = false;
      return;
    }
    try {
      const managed = await this.ownership.isManaged(this.managedKind, this.managedResourceId);
      if (request !== this.request) return;
      this.managed = managed;
      this.changeDetector.markForCheck();
    } catch {
      // The backend remains authoritative if ownership metadata cannot be loaded.
    }
  }
}
