import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { WebhookConfig } from '@eudiplo/sdk-core';

@Component({
  selector: 'app-webhook-config-show',
  imports: [MatCardModule, MatIconModule, MatExpansionModule],
  templateUrl: './webhook-config-show.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './webhook-config-show.component.scss',
})
export class WebhookConfigShowComponent {
  @Input() config?: WebhookConfig;

  @Input() title!: string;
  @Input() descriptions!: string;

  formatJsonValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value, null, 2);
  }
}
