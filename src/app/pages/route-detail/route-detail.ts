import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorText } from '../../core/api.service';
import { RouteDetail } from '../../core/models';
import { baht, fmtDate, fullName, mapsUrl, num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { MapRoute, RouteMap, riderColorIndex, routeColor } from '../../shared/route-map';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-route-detail',
  imports: [RouterLink, RouteMap, StatusBadge],
  template: `
    <a routerLink="/routes" class="text-sm font-medium text-brand-600 hover:underline">← เส้นทางทั้งหมด</a>

    @if (loading()) {
      <div class="skeleton mt-4 h-64"></div>
    } @else if (!route()) {
      <div class="card mt-4 px-6 py-14 text-center text-sm text-slate-500">ไม่พบเส้นทางนี้</div>
    } @else {
      @let r = route()!;
      <div class="mb-6 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold">เส้นทาง #{{ r.id }} · <span [style.color]="color(r)">{{ r.rider_name }}</span></h1>
          <p class="text-sm text-slate-500">โทร {{ r.rider_phone }} · สร้างเมื่อ {{ date(r.created_at) }}</p>
        </div>
        <div class="flex gap-6 text-right">
          <div>
            <p class="text-xs text-slate-500">ระยะทาง</p>
            <p class="text-lg font-bold">{{ n(r.total_km).toFixed(2) }} กม.</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">ค่าไรเดอร์</p>
            <p class="text-lg font-bold">{{ money(r.total_cost) }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">ส่งแล้ว</p>
            <p class="text-lg font-bold">{{ delivered() }}/{{ r.stops.length }}</p>
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-5">
        <div class="card p-4 lg:col-span-3">
          <h2 class="mb-3 font-semibold">แผนผังจุดส่ง</h2>
          <app-route-map [routes]="mapRoutes()" />
          <p class="mt-2 text-xs text-slate-500">เส้นเริ่มจากจุดส่งที่ 1 (ไม่แสดงตำแหน่งร้านในหน้านี้) · แตะหมุดเพื่อดูเลขออเดอร์</p>
        </div>
        <div class="card lg:col-span-2">
          <ol class="divide-y divide-slate-100">
            @for (s of r.stops; track s.order_id) {
              <li class="flex items-start gap-3 p-4">
                <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" [style.background]="color(r)">{{ s.seq }}</span>
                <div class="min-w-0 flex-1">
                  <p class="font-medium"><span class="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">ออเดอร์ #{{ s.order_id }}</span>{{ name(s) }}</p>
                  <p class="text-sm text-slate-600">{{ s.address || '-' }}</p>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ s.boxes }} กล่อง · {{ s.phone }} ·
                    <a class="text-brand-600 hover:underline" target="_blank" rel="noopener" [href]="map(s)">เปิดแผนที่</a>
                  </p>
                </div>
                <app-status-badge [status]="s.status" />
              </li>
            }
          </ol>
        </div>
      </div>
    }
  `,
})
export class RouteDetailPage {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  /** รับค่า :id จาก URL (withComponentInputBinding) */
  id = input.required<string>();

  loading = signal(true);
  route = signal<RouteDetail | null>(null);

  delivered = computed(() => this.route()?.stops.filter(s => s.status === 'delivered').length ?? 0);
  mapRoutes = computed<MapRoute[]>(() => {
    const r = this.route();
    return r
      ? [
          {
            name: r.rider_name,
            colorIndex: riderColorIndex(r.rider_id),
            stops: r.stops.map(s => ({ lat: num(s.lat), lng: num(s.lng), seq: s.seq, label: `ออเดอร์ #${s.order_id} · ${fullName(s)} · ${s.boxes} กล่อง` })),
          },
        ]
      : [];
  });

  name = fullName;
  color = (r: { rider_id: number }) => routeColor(riderColorIndex(r.rider_id));
  n = num;
  money = baht;
  date = fmtDate;
  map = (s: { lat: unknown; lng: unknown }) => mapsUrl(s.lat, s.lng);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      this.loading.set(true);
      this.api.route(id).subscribe({
        next: r => {
          this.route.set(r);
          this.loading.set(false);
        },
        error: e => {
          this.route.set(null);
          this.loading.set(false);
          this.toast.error(errorText(e));
        },
      });
    });
  }
}
