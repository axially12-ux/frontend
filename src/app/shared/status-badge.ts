import { Component, computed, input } from '@angular/core';
import { OrderStatus } from '../core/models';

const LABELS: Record<OrderStatus, string> = {
  pending: 'รอจัดส่ง',
  assigned: 'กำลังส่ง',
  delivered: 'ส่งแล้ว',
};

const STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  assigned: 'bg-sky-100 text-sky-800 ring-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
};

@Component({
  selector: 'app-status-badge',
  template: `<span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
    [class]="styles()"
    >{{ label() }}</span
  >`,
})
export class StatusBadge {
  status = input.required<OrderStatus>();
  label = computed(() => LABELS[this.status()] ?? this.status());
  styles = computed(() => STYLES[this.status()] ?? 'bg-slate-100 text-slate-700 ring-slate-200');
}
