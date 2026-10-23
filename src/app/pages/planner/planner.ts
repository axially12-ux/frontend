import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorText } from '../../core/api.service';
import { PlanResult } from '../../core/models';
import { baht, num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { MapRoute, ROUTE_COLORS, ROUTE_COLOR_NAMES, RouteMap } from '../../shared/route-map';

@Component({
  selector: 'app-planner',
  imports: [RouterLink, RouteMap],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">จัดเส้นทางไรเดอร์</h1>
        <p class="text-sm text-slate-500">กดคำนวณตอนอาหารเสร็จ (ประมาณ 11:30 น.) · ต้องถึงมือลูกค้าไม่เกิน 12:30 น. · ไรเดอร์คนละไม่เกิน 3 ออเดอร์</p>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn" [class]="plan() ? 'btn-ghost' : 'btn-primary'" [disabled]="loading() || saving()" (click)="calculate()">
          {{ loading() ? 'กำลังคำนวณ…' : plan() ? '↻ คำนวณใหม่' : '★ คำนวณเส้นทางที่ดีที่สุด' }}
        </button>
        @if (plan()?.routes?.length) {
          <button type="button" class="btn btn-primary" [disabled]="saving() || loading()" (click)="save()">
            {{ saving() ? 'กำลังบันทึก…' : '✓ ใช้แผนนี้ มอบหมายงาน' }}
          </button>
        }
      </div>
    </div>

    @if (loading() && !plan()) {
      <div class="card p-8 text-center text-sm text-slate-500">
        <div class="skeleton mx-auto mb-4 h-4 w-48"></div>
        กำลังหาเส้นทางที่ดีที่สุด… (ครั้งแรกอาจใช้เวลาสักครู่เพราะเซิร์ฟเวอร์ต้องตื่น)
      </div>
    } @else if (!plan()) {
      <div class="card px-6 py-16 text-center">
        <p class="text-4xl">🛵</p>
        <p class="mt-3 font-semibold">ยังไม่ได้คำนวณ</p>
        <p class="mx-auto mt-1 max-w-sm text-sm text-slate-500">กดปุ่มเดียว ระบบจะลองหลายแบบแล้วเลือกเส้นทางที่ดีที่สุดให้ทันที (ไรเดอร์คนละไม่เกิน 3 ออเดอร์ และเรียงลำดับส่งให้สั้นที่สุด)</p>
        <button type="button" class="btn btn-primary mt-5" (click)="calculate()">★ คำนวณเส้นทางที่ดีที่สุด</button>
      </div>
    } @else {
      @let p = plan()!;
      @if (!p.routes.length) {
        <div class="card px-6 py-14 text-center">
          <p class="font-semibold">{{ p.message || 'ไม่มีเส้นทางให้จัด' }}</p>
          <a routerLink="/orders" class="btn btn-primary mt-4">ไปหน้าออเดอร์</a>
        </div>
      } @else {
        <!-- แจ้งเตือนขาดทุน -->
        @if (loss()) {
          <div class="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-900 ring-1 ring-red-200">
            <p><b>แผนนี้ขาดทุน {{ money(-n(p.summary.profit_before_other_expenses)) }}</b> (ค่าไรเดอร์ {{ money(p.summary.total_rider_cost) }} สูงกว่ากำไรจากอาหาร) นี่คือแผนที่ดีที่สุดที่ระบบหาได้แล้ว ออเดอร์อาจน้อยหรืออยู่ไกลเกินไป</p>
          </div>
        }

        <!-- สรุปภาพรวม -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div class="card p-4">
            <p class="text-xs text-slate-500">ออเดอร์ที่จัดได้</p>
            <p class="mt-1 text-2xl font-bold">{{ p.summary.orders_assigned }} <span class="text-sm font-medium text-slate-500">/ ไรเดอร์ {{ p.summary.riders_used }} คน</span></p>
            <p class="text-xs text-slate-500">ระยะทางรวม {{ n(p.summary.total_km).toFixed(2) }} กม.</p>
          </div>
          <div class="card p-4">
            <p class="text-xs text-slate-500">เวลาที่ใช้ (ไรเดอร์ที่ช้าสุด)</p>
            <p class="mt-1 text-2xl font-bold" [class]="p.summary.within_one_hour === false ? 'text-red-600' : ''">{{ maxMinutes(p) }} <span class="text-sm font-medium text-slate-500">นาที</span></p>
            <p class="text-xs" [class]="p.summary.within_one_hour === false ? 'font-semibold text-red-600' : 'text-emerald-600'">
              {{ p.summary.within_one_hour === false ? '⚠ เกิน 12:30 น. ' + (p.summary.late_riders ? '(' + p.summary.late_riders + ' คน) ' : '') + 'เสี่ยงโดนปรับ' : '✓ ทันก่อน 12:30 น.' }}
            </p>
          </div>
          <div class="card p-4">
            <p class="text-xs text-slate-500">รายได้ − ต้นทุนอาหาร</p>
            <p class="mt-1 text-lg font-bold">{{ money(p.summary.revenue) }} <span class="font-medium text-slate-400">−</span> {{ money(p.summary.food_cost) }}</p>
            <p class="text-xs text-slate-500">ค่าไรเดอร์รวม {{ money(p.summary.total_rider_cost) }}</p>
          </div>
          <div class="card p-4" [class]="loss() ? '!bg-red-50' : '!bg-emerald-50'">
            <p class="text-xs text-slate-500">{{ loss() ? 'ขาดทุน' : 'กำไร' }}ก่อนค่าใช้จ่ายอื่น</p>
            <p class="mt-1 text-2xl font-bold" [class]="loss() ? 'text-red-600' : 'text-emerald-600'">{{ money(p.summary.profit_before_other_expenses) }}</p>
            <p class="text-xs text-slate-500">หลังหักค่าไรเดอร์แล้ว</p>
          </div>
        </div>

        @if (p.distance_source === 'estimate') {
          <div class="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <p class="font-semibold">ตัวเลขนี้เป็นการประมาณ</p>
            <p class="mt-0.5">เซิร์ฟเวอร์ขอข้อมูลถนนจริงไม่ได้ชั่วคราว จึงประมาณระยะทางจากเส้นตรง × 1.3 ลองกด "คำนวณใหม่" อีกครั้งในอีกสักครู่เพื่อให้ได้ระยะตามถนนจริง</p>
          </div>
        }

        @if (p.unassigned.length) {
          <div class="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            <p class="font-semibold">จัดไม่ได้ {{ p.unassigned.length }} ออเดอร์ (#{{ unassignedIds() }})</p>
            <p class="mt-0.5">{{ p.unassigned[0].reason }}</p>
          </div>
        }

        <!-- แผนที่ขนาดใหญ่ -->
        <div class="card mt-4 p-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold">แผนที่เส้นทางไรเดอร์</h2>
            <p class="text-xs text-slate-500">ตัวเลขคือลำดับส่ง · เส้นเริ่มจากร้าน · แตะหมุดเพื่อดูชื่อลูกค้า · {{ p.distance_source === 'estimate' ? 'ระยะทางที่คำนวณเป็นค่าประมาณ (เส้นตรง × 1.3)' : 'ระยะทางที่คำนวณเป็นระยะตามถนนจริง' }}</p>
          </div>
          <app-route-map [shop]="shop()" [routes]="mapRoutes()" height="min(70vh, 36rem)" />
        </div>

        <!-- รายละเอียดไรเดอร์แต่ละคน -->
        <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (r of p.routes; track r.rider_id; let i = $index) {
            <div class="card overflow-hidden">
              <div class="flex items-center justify-between gap-2 px-4 py-3" [style.border-left]="'6px solid ' + color(i)">
                <div>
                  <p class="font-semibold">{{ r.rider_name }} <span class="text-xs font-medium" [style.color]="color(i)">({{ colorName(i) }})</span>@if (r.is_new) { <span class="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">เรียกเพิ่ม</span> }</p>
                  <p class="text-xs text-slate-500">{{ r.orders_count }} ออเดอร์ · {{ r.total_boxes }} กล่อง · {{ r.total_km }} กม.</p>
                  <p class="mt-0.5 text-xs text-slate-500">เลขใบงานออกให้ตอนกดบันทึก</p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-semibold">ถึงประมาณ {{ r.estimated_arrival }}</p>
                  <p class="text-xs text-slate-500">~{{ r.estimated_minutes }} นาที</p>
                </div>
              </div>
              <ol class="divide-y divide-slate-100 border-t border-slate-100">
                @for (s of r.stops; track s.order_id) {
                  <li class="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" [style.background]="color(i)">{{ s.seq }}</span>
                    <div class="min-w-0 flex-1">
                      <p class="font-medium">{{ s.customer_name }} <span class="text-slate-400">· #{{ s.order_id }}</span></p>
                      <p class="truncate text-xs text-slate-500">{{ s.address || '-' }}</p>
                    </div>
                    <div class="text-right text-xs text-slate-500">
                      <p>{{ s.boxes }} กล่อง</p>
                      <p>{{ s.arrive_time ? 'ถึง ' + s.arrive_time + ' · ' : '' }}+{{ s.leg_km }} กม.</p>
                    </div>
                  </li>
                }
              </ol>
              <div class="flex justify-between bg-slate-50 px-4 py-2 text-xs text-slate-600">
                <span>ค่าไรเดอร์ {{ money(r.rider_cost) }}</span>
                <span [class]="n(r.profit_before_other_expenses) < 0 ? 'font-semibold text-red-600' : ''">{{ n(r.profit_before_other_expenses) < 0 ? 'ขาดทุน' : 'กำไร' }} {{ money(r.profit_before_other_expenses) }}</span>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
})
export class Planner {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  loading = signal(false);
  saving = signal(false);
  plan = signal<PlanResult | null>(null);
  loss = computed(() => num(this.plan()?.summary.profit_before_other_expenses) < 0);

  shop = computed(() => {
    const s = this.plan()?.shop;
    return s ? { lat: num(s.lat), lng: num(s.lng) } : null;
  });
  mapRoutes = computed<MapRoute[]>(() =>
    (this.plan()?.routes ?? []).map(r => ({
      name: r.rider_name,
      stops: r.stops.map(s => ({ lat: s.lat, lng: s.lng, seq: s.seq, label: `${s.customer_name} · ${s.boxes} กล่อง` })),
    })),
  );
  unassignedIds = computed(() => (this.plan()?.unassigned ?? []).map(u => u.order_id).join(', #'));

  n = num;
  money = baht;
  color = (i: number) => ROUTE_COLORS[i % ROUTE_COLORS.length];
  colorName = (i: number) => ROUTE_COLOR_NAMES[i % ROUTE_COLOR_NAMES.length];
  maxMinutes = (p: PlanResult) => Math.max(0, ...p.routes.map(r => num(r.estimated_minutes)));

  /** ให้เซิร์ฟเวอร์ลองหลายแบบแล้วเลือกแผนที่ดีที่สุดเพียงแผนเดียว */
  calculate() {
    this.loading.set(true);
    this.api.calculate().subscribe({
      next: r => {
        this.plan.set(r);
        this.loading.set(false);
      },
      error: e => {
        this.toast.error(errorText(e));
        this.loading.set(false);
      },
    });
  }

  /** force = ยืนยันแล้วว่าจะบันทึกทั้งที่มีไรเดอร์ถึงเกิน 12:30 */
  save(force = false) {
    const p = this.plan();
    if (!p?.routes.length) return;
    if (!force && this.loss() && !confirm('แผนนี้ขาดทุน ต้องการมอบหมายงานตามแผนนี้จริงหรือไม่?')) return;
    const assignments = p.routes.map(r => ({ rider_id: r.rider_id, rider_name: r.rider_name, order_ids: r.stops.map(s => s.order_id) }));
    this.saving.set(true);
    this.api.saveRoutes(assignments, force).subscribe({
      next: () => {
        this.toast.ok('บันทึกเส้นทางและมอบหมายงานสำเร็จ');
        this.saving.set(false);
        this.router.navigateByUrl('/routes');
      },
      error: e => {
        this.saving.set(false);
        // เซิร์ฟเวอร์ไม่บันทึกเพราะมีไรเดอร์ที่คาดว่าถึงเกิน 12:30 -> ให้ผู้ใช้ตัดสินใจ
        if (e instanceof HttpErrorResponse && e.status === 409 && e.error?.code === 'LATE') {
          if (confirm(`${e.error.error}\n\nต้องการบันทึกทั้งที่ส่งไม่ทันหรือไม่?\n(กดยกเลิกแล้วลองคำนวณใหม่เพื่อหาแผนที่ทันเวลา)`)) this.save(true);
          return;
        }
        this.toast.error(errorText(e));
      },
    });
  }
}
