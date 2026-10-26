import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorText } from '../../core/api.service';
import { SavedRoute } from '../../core/models';
import { baht, fmtDate, num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { Modal } from '../../shared/modal';
import { riderColorIndex, routeColor } from '../../shared/route-map';

@Component({
  selector: 'app-routes',
  imports: [RouterLink, Modal],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">เส้นทางที่บันทึก</h1>
        <p class="text-sm text-slate-500">{{ routes().length }} เส้นทาง · ใหม่สุดอยู่บนสุด</p>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn btn-danger" [disabled]="!routes().length || busy()" (click)="clearOpen.set(true)">ลบทั้งหมด</button>
        <a routerLink="/planner" class="btn btn-primary">+ จัดเส้นทางใหม่</a>
      </div>
    </div>

    @if (loading()) {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (i of [1, 2, 3]; track i) {
          <div class="skeleton h-36"></div>
        }
      </div>
    } @else if (!routes().length) {
      <div class="card px-6 py-16 text-center">
        <p class="font-semibold">ยังไม่มีเส้นทางที่บันทึก</p>
        <p class="mt-1 text-sm text-slate-500">ไปหน้าจัดเส้นทางเพื่อคำนวณและบันทึก</p>
        <a routerLink="/planner" class="btn btn-primary mt-4">จัดเส้นทาง</a>
      </div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (r of routes(); track r.route_id) {
          <div class="card flex flex-col border-l-4 transition hover:shadow-md hover:ring-brand-200" [style.border-left-color]="color(r)">
            <a [routerLink]="['/routes', r.route_id]" class="block flex-1 p-5">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-xs text-slate-500">เส้นทาง #{{ r.route_id }}</p>
                  <p class="text-lg font-semibold">{{ r.rider_name }}</p>
                  @if (r.rider_access_code) {
                    <p class="text-xs text-slate-500">เลขใบงาน: <b class="font-mono text-base text-slate-900">{{ r.rider_access_code }}</b></p>
                  }
                </div>
                <span class="rounded-full px-2.5 py-1 text-xs font-semibold" [class]="r.orders_count ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'">{{ r.orders_count }} จุด</span>
              </div>
              <dl class="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt class="text-xs text-slate-500">ระยะทาง</dt>
                  <dd class="font-semibold">{{ n(r.total_km).toFixed(2) }} กม.</dd>
                </div>
                <div>
                  <dt class="text-xs text-slate-500">ค่าไรเดอร์</dt>
                  <dd class="font-semibold">{{ money(r.total_cost) }}</dd>
                </div>
                <div>
                  <dt class="text-xs text-slate-500">ส่งแล้ว</dt>
                  <dd class="font-semibold" [class.text-emerald-600]="n(r.delivered_count) > 0 && n(r.delivered_count) === r.orders_count">{{ n(r.delivered_count) }}/{{ r.orders_count }}</dd>
                </div>
              </dl>
              @if (r.order_ids) {
                <p class="mt-3 truncate text-xs text-slate-500">ออเดอร์: #{{ r.order_ids.split(',').join(' → #') }}</p>
              } @else {
                <p class="mt-3 text-xs text-amber-700">ไม่มีออเดอร์ในเส้นทางนี้แล้ว (ออเดอร์ถูกลบไปแล้ว)</p>
              }
              <p class="mt-1 text-xs text-slate-400">{{ date(r.created_at) }}</p>
            </a>
            <div class="flex justify-end border-t border-slate-100 px-4 py-2">
              <button type="button" class="btn btn-danger !px-2.5 !py-1" [disabled]="busy()" (click)="deleting.set(r)">ลบเส้นทาง</button>
            </div>
          </div>
        }
      </div>
    }

    <app-modal [open]="!!deleting()" title="ลบเส้นทาง?" (closed)="deleting.set(null)">
      @if (deleting(); as d) {
        <p class="text-sm text-slate-600">ลบเส้นทาง <b>#{{ d.route_id }}</b> ของ {{ d.rider_name }}? ออเดอร์ที่ยังไม่ได้ส่งจะกลับเป็น "รอจัดส่ง" เพื่อจัดเส้นทางใหม่ได้ (ออเดอร์ที่ส่งแล้วจะไม่เปลี่ยน)</p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" (click)="deleting.set(null)">ยกเลิก</button>
          <button type="button" class="btn btn-primary !bg-red-600" [disabled]="busy()" (click)="confirmDelete()">{{ busy() ? 'กำลังลบ…' : 'ลบ' }}</button>
        </div>
      }
    </app-modal>

    <app-modal [open]="clearOpen()" title="ลบเส้นทางทั้งหมด?" (closed)="clearOpen.set(false)">
      <p class="text-sm text-slate-600">จะลบเส้นทางที่บันทึกไว้ทั้ง {{ routes().length }} เส้น ออเดอร์ที่ยังไม่ได้ส่งจะกลับเป็น "รอจัดส่ง"</p>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" (click)="clearOpen.set(false)">ยกเลิก</button>
        <button type="button" class="btn btn-primary !bg-red-600" [disabled]="busy()" (click)="confirmClear()">{{ busy() ? 'กำลังลบ…' : 'ลบทั้งหมด' }}</button>
      </div>
    </app-modal>
  `,
})
export class RoutesPage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  routes = signal<SavedRoute[]>([]);
  color = (r: { rider_id: number }) => routeColor(riderColorIndex(r.rider_id));
  n = num;
  money = baht;
  date = fmtDate;

  busy = signal(false);
  deleting = signal<SavedRoute | null>(null);
  clearOpen = signal(false);

  ngOnInit() {
    this.load();
  }

  private load() {
    this.api.savedRoutes().subscribe({
      next: list => {
        this.routes.set(list);
        this.loading.set(false);
      },
      error: e => {
        this.toast.error(errorText(e));
        this.loading.set(false);
      },
    });
  }

  confirmDelete() {
    const r = this.deleting();
    if (!r) return;
    this.busy.set(true);
    this.api.deleteRoute(r.route_id).subscribe({
      next: () => {
        this.toast.ok(`ลบเส้นทาง #${r.route_id} แล้ว`);
        this.busy.set(false);
        this.deleting.set(null);
        this.load();
      },
      error: e => {
        this.toast.error(errorText(e));
        this.busy.set(false);
      },
    });
  }

  confirmClear() {
    this.busy.set(true);
    this.api.clearRoutes().subscribe({
      next: () => {
        this.toast.ok('ลบเส้นทางทั้งหมดแล้ว');
        this.busy.set(false);
        this.clearOpen.set(false);
        this.load();
      },
      error: e => {
        this.toast.error(errorText(e));
        this.busy.set(false);
      },
    });
  }
}