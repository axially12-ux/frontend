import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorText } from '../../core/api.service';
import { RiderJob } from '../../core/models';
import { baht, fullName, mapsUrl, num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { StatusBadge } from '../../shared/status-badge';

const STORAGE_KEY = 'rider.access_code';

/** หน้ามือถือสำหรับไรเดอร์: ใส่รหัสเข้าดูงาน ดูจุดส่งตามลำดับ และกดส่งเสร็จ */
@Component({
  selector: 'app-rider',
  imports: [FormsModule, StatusBadge],
  template: `
    <div class="mx-auto max-w-md">
      <h1 class="text-2xl font-bold">สำหรับไรเดอร์</h1>
      <p class="mb-5 text-sm text-slate-500">กรอกเลขใบงานเพื่อดูงานของคุณวันนี้</p>

      <form class="card flex gap-2 p-4" (ngSubmit)="load()">
        <input class="field" name="code" [(ngModel)]="code" placeholder="กรอกเลขใบงาน" aria-label="เลขใบงาน" autocomplete="off" autocapitalize="off" />
        <button class="btn btn-primary" type="submit" [disabled]="loading() || !code.trim()">{{ loading() ? '…' : 'ดูงาน' }}</button>
      </form>

      @if (error()) {
        <p class="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">{{ error() }}</p>
      }

      @if (job(); as j) {
        <div class="card mt-4 p-5">
          <p class="text-xs text-slate-500">สวัสดี</p>
          <p class="text-xl font-bold">{{ j.rider.name }}</p>
          <p class="text-sm text-slate-500">{{ j.rider.phone }}</p>
        </div>

        @if (!j.route) {
          <p class="card mt-4 p-6 text-center text-sm text-slate-500">{{ j.message || 'ยังไม่มีงานที่ได้รับมอบหมาย' }}</p>
        } @else {
          <div class="card mt-4 p-5">
            <p class="text-xs text-slate-500">วันนี้ต้องหยิบข้าวกล่องไปทั้งหมด</p>
            <p class="text-4xl font-bold text-brand-600">{{ totalBoxes() }} <span class="text-lg font-semibold text-slate-600">กล่อง</span></p>
            <p class="mt-1 text-sm text-slate-600">{{ j.stops?.length }} จุดส่ง · {{ n(j.route.total_km).toFixed(2) }} กม. · เส้นทาง #{{ j.route.route_id }}</p>
            <p class="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">{{ summary() }}</p>
            <div class="mt-3 flex items-center justify-between text-sm">
              <span class="text-slate-500">ส่งแล้ว</span>
              <span class="text-lg font-bold">{{ done() }}/{{ j.stops?.length }}</span>
            </div>
            <a class="btn btn-primary mt-3 w-full !py-3 text-base" target="_blank" rel="noopener" [href]="routeUrl()">🧭 เปิดแผนที่นำทางทั้งเส้นทาง</a>
          </div>

          <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" [attr.aria-valuenow]="done()" aria-valuemin="0" [attr.aria-valuemax]="j.stops?.length">
            <div class="h-full bg-emerald-500 transition-all" [style.width.%]="progress()"></div>
          </div>

          <ol class="mt-4 space-y-3">
            @for (s of j.stops; track s.order_id) {
              <li class="card p-4" [class.opacity-60]="s.status === 'delivered'">
                <div class="flex items-start gap-3">
                  <span class="flex h-8 shrink-0 items-center justify-center rounded-full bg-brand-600 px-3 text-sm font-bold text-white">จุดที่ {{ s.seq }}</span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <p class="font-semibold">{{ name(s) }}</p>
                      <app-status-badge [status]="s.status" />
                    </div>
                    <p class="mt-0.5 text-sm text-slate-600">{{ s.address || '-' }}</p>
                    <p class="mt-1 text-sm font-semibold text-slate-700">ส่ง {{ s.boxes }} กล่อง <span class="font-normal text-slate-500">· ออเดอร์ #{{ s.order_id }}</span></p>
                  </div>
                </div>
                <div class="mt-3 grid grid-cols-3 gap-2">
                  <a class="btn btn-ghost" [href]="'tel:' + s.phone">📞 โทร</a>
                  <a class="btn btn-ghost" target="_blank" rel="noopener" [href]="map(s)">📍 แผนที่</a>
                  <button type="button" class="btn btn-primary" [disabled]="s.status !== 'assigned' || busyId() === s.order_id" (click)="deliver(s.order_id)">
                    {{ s.status === 'delivered' ? 'ส่งแล้ว' : busyId() === s.order_id ? '…' : '✓ ส่งแล้ว' }}
                  </button>
                </div>
              </li>
            }
          </ol>
        }
      }
    </div>
  `,
})
export class RiderPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  code = this.saved();
  loading = signal(false);
  busyId = signal<number | null>(null);
  error = signal('');
  job = signal<RiderJob | null>(null);

  done = computed(() => this.job()?.stops?.filter(s => s.status === 'delivered').length ?? 0);
  progress = computed(() => {
    const total = this.job()?.stops?.length ?? 0;
    return total ? (this.done() / total) * 100 : 0;
  });

  totalBoxes = computed(() => (this.job()?.stops ?? []).reduce((t, s) => t + num(s.boxes), 0));
  summary = computed(() =>
    (this.job()?.stops ?? []).map(s => `จุดที่ ${s.seq} บ้านคุณ${s.first_name}`).join(' → '),
  );
  /** ลิงก์ Google Maps นำทางผ่านทุกจุดตามลำดับ (เริ่มจากตำแหน่งปัจจุบันของไรเดอร์) */
  routeUrl = computed(() => {
    const st = [...(this.job()?.stops ?? [])].sort((a, b) => a.seq - b.seq);
    if (!st.length) return '#';
    const pt = (s: { lat: unknown; lng: unknown }) => `${num(s.lat)},${num(s.lng)}`;
    const last = st[st.length - 1];
    const via = st.slice(0, -1).map(pt).join('|');
    return `https://www.google.com/maps/dir/?api=1&travelmode=motorcycle&destination=${pt(last)}${via ? '&waypoints=' + encodeURIComponent(via) : ''}`;
  });

  name = fullName;
  n = num;
  money = baht;
  map = (s: { lat: unknown; lng: unknown }) => mapsUrl(s.lat, s.lng);

  constructor() {
    if (this.code) this.load();
  }

  load() {
    const code = this.code.trim();
    if (!code) return;
    this.loading.set(true);
    this.error.set('');
    this.api.riderJob(code).subscribe({
      next: j => {
        this.job.set(j);
        this.loading.set(false);
        this.remember(code);
      },
      error: e => {
        this.job.set(null);
        this.error.set(errorText(e));
        this.loading.set(false);
      },
    });
  }

  deliver(orderId: number) {
    this.busyId.set(orderId);
    this.api.markDelivered(orderId).subscribe({
      next: () => {
        this.job.update(j => (j ? { ...j, stops: j.stops?.map(s => (s.order_id === orderId ? { ...s, status: 'delivered' as const } : s)) } : j));
        this.busyId.set(null);
        this.toast.ok(`ส่งออเดอร์ #${orderId} เรียบร้อย`);
      },
      error: e => {
        this.busyId.set(null);
        this.toast.error(errorText(e));
      },
    });
  }

  private saved(): string {
    try {
      return typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) ?? '') : '';
    } catch {
      return '';
    }
  }

  private remember(code: string) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ไม่เป็นไรถ้าบันทึกไม่ได้ */
    }
  }
}
