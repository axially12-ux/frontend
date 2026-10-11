import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Customer, Order, SavedRoute } from '../../core/models';
import { baht, fmtDate, fullName, num } from '../../core/format';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, StatusBadge],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">ภาพรวม</h1>
        <p class="text-sm text-slate-500">สถานะการจัดส่งวันนี้ (ส่งช่วง 11:30–12:30)</p>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span class="h-2.5 w-2.5 rounded-full" [class]="serverOk() === null ? 'bg-slate-300' : serverOk() ? 'bg-emerald-500' : 'bg-red-500'"></span>
        <span class="text-slate-600">{{ serverOk() === null ? 'กำลังเชื่อมต่อเซิร์ฟเวอร์…' : serverOk() ? 'เซิร์ฟเวอร์และฐานข้อมูลพร้อมใช้งาน' : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' }}</span>
        <button type="button" class="btn btn-ghost" (click)="load()">รีเฟรช</button>
      </div>
    </div>

    @if (loading()) {
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        @for (i of [1, 2, 3, 4]; track i) {
          <div class="skeleton h-28"></div>
        }
      </div>
    } @else {
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="card p-5">
          <p class="text-sm text-slate-500">ลูกค้าทั้งหมด</p>
          <p class="mt-1 text-3xl font-bold">{{ customers().length }}</p>
        </div>
        <div class="card p-5">
          <p class="text-sm text-slate-500">รอจัดส่ง</p>
          <p class="mt-1 text-3xl font-bold text-amber-600">{{ count().pending }}</p>
        </div>
        <div class="card p-5">
          <p class="text-sm text-slate-500">กำลังส่ง</p>
          <p class="mt-1 text-3xl font-bold text-sky-600">{{ count().assigned }}</p>
        </div>
        <div class="card p-5">
          <p class="text-sm text-slate-500">ส่งแล้ว</p>
          <p class="mt-1 text-3xl font-bold text-emerald-600">{{ count().delivered }}</p>
        </div>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <div class="card p-5 lg:col-span-2">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="font-semibold">ออเดอร์ล่าสุด</h2>
            <a routerLink="/orders" class="text-sm font-medium text-brand-600 hover:underline">ดูทั้งหมด</a>
          </div>
          @if (!recent().length) {
            <p class="py-8 text-center text-sm text-slate-500">ยังไม่มีออเดอร์ — ไปที่หน้าออเดอร์เพื่อสร้างหรือจำลองออเดอร์</p>
          } @else {
            <ul class="divide-y divide-slate-100">
              @for (o of recent(); track o.id) {
                <li class="flex items-center justify-between gap-3 py-2.5">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">#{{ o.id }} · {{ name(o) }}</p>
                    <p class="truncate text-xs text-slate-500">{{ o.boxes }} กล่อง · {{ date(o.created_at) }}</p>
                  </div>
                  <app-status-badge [status]="o.status" />
                </li>
              }
            </ul>
          }
        </div>

        <div class="space-y-4">
          <div class="card p-5">
            <h2 class="font-semibold">รายได้โดยประมาณ (ส่งแล้ว)</h2>
            <p class="mt-1 text-2xl font-bold">{{ money(deliveredRevenue()) }}</p>
            <p class="text-xs text-slate-500">คิดจาก 65 บาท/กล่อง</p>
          </div>
          <div class="card p-5">
            <h2 class="font-semibold">เส้นทางที่บันทึกไว้</h2>
            <p class="mt-1 text-2xl font-bold">{{ routes().length }}</p>
            @if (routes()[0]; as r) {
              <p class="text-xs text-slate-500">ล่าสุด: {{ r.rider_name }} · {{ date(r.created_at) }}</p>
            }
          </div>
          <div class="card space-y-2 p-5">
            <h2 class="font-semibold">ทางลัด</h2>
            <a routerLink="/planner" class="btn btn-primary w-full">จัดเส้นทางไรเดอร์</a>
            <a routerLink="/orders" class="btn btn-ghost w-full">จัดการออเดอร์</a>
            <a routerLink="/rider" class="btn btn-ghost w-full">หน้าสำหรับไรเดอร์</a>
          </div>
        </div>
      </div>
    }
  `,
})
export class Dashboard implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  serverOk = signal<boolean | null>(null);
  customers = signal<Customer[]>([]);
  orders = signal<Order[]>([]);
  routes = signal<SavedRoute[]>([]);

  count = computed(() => {
    const c = { pending: 0, assigned: 0, delivered: 0 };
    for (const o of this.orders()) c[o.status]++;
    return c;
  });
  recent = computed(() => [...this.orders()].sort((a, b) => b.id - a.id).slice(0, 6));
  deliveredRevenue = computed(() =>
    this.orders().filter(o => o.status === 'delivered').reduce((s, o) => s + num(o.boxes) * 65, 0),
  );

  name = fullName;
  date = fmtDate;
  money = baht;

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.serverOk.set(null);
    forkJoin({
      health: this.api.health().pipe(catchError(() => of(null))),
      customers: this.api.customers().pipe(catchError(() => of([] as Customer[]))),
      orders: this.api.orders().pipe(catchError(() => of([] as Order[]))),
      routes: this.api.savedRoutes().pipe(catchError(() => of([] as SavedRoute[]))),
    }).subscribe(r => {
      this.serverOk.set(r.health?.status === 'ok');
      this.customers.set(r.customers);
      this.orders.set(r.orders);
      this.routes.set(r.routes);
      this.loading.set(false);
    });
  }
}
