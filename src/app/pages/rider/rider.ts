
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, errorText } from '../../core/api.service';
import { RiderJob, RiderStop } from '../../core/models';
import { baht, fmtDate, fmtTime, fullName, mapsUrl, num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { StatusBadge } from '../../shared/status-badge';

const STORAGE_KEY = 'rider.access_code';

type Tab = 'todo' | 'done' | 'all';

/**
 * หน้ามือถือสำหรับไรเดอร์
 * - ใส่เลขใบงานเพื่อดูเส้นทางล่าสุดของไรเดอร์
 * - ค้นหาออเดอร์ของตัวเอง
 * - เช็กลิสต์หยิบของที่ร้าน
 * - แสดงจุดส่งและเวลาถึงโดยประมาณ
 * - ยืนยันการส่งออเดอร์
 */
@Component({
  selector: 'app-rider',
  imports: [FormsModule, StatusBadge],
  template: `
    <div class="mx-auto max-w-md pb-10">

      <!-- หัวหน้าและปุ่มกลับหน้า Login -->
      <div class="mb-4 flex items-center justify-between gap-3">
        <h1 class="text-2xl font-bold">สำหรับไรเดอร์</h1>

        <button
          type="button"
          class="btn btn-ghost shrink-0 text-sm"
          (click)="goToLogin()"
        >
          ← ย้อนกลับ
        </button>
      </div>

      @if (!job()) {
        <p class="mb-5 text-sm text-slate-500">
          กรอกเลขใบงานเพื่อดูงานของคุณ (ขอเลขใบงานจากร้าน)
        </p>

        <form class="card flex gap-2 p-4" (ngSubmit)="load()">
          <input
            class="field font-mono"
            name="code"
            [(ngModel)]="code"
            placeholder="เช่น 1013-00748"
            aria-label="เลขใบงาน"
            autocomplete="off"
            autocapitalize="off"
            inputmode="text"
          />

          <button
            class="btn btn-primary"
            type="submit"
            [disabled]="loading() || !code.trim()"
          >
            {{ loading() ? '…' : 'ดูงาน' }}
          </button>
        </form>

        @if (error()) {
          <p class="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
            {{ error() }}
          </p>
        }
      }

      @if (job(); as j) {
        <!-- ข้อมูลไรเดอร์ -->
        <div class="card mt-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs text-slate-500">สวัสดี</p>
              <p class="truncate text-xl font-bold">{{ j.rider.name }}</p>

              @if (j.rider.phone && j.rider.phone !== '-') {
                <p class="text-sm text-slate-500">{{ j.rider.phone }}</p>
              }
            </div>

            <div class="text-right">
              <p class="text-xs text-slate-500">เลขใบงาน</p>
              <p class="font-mono text-base font-bold">{{ code }}</p>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              class="btn btn-ghost"
              [disabled]="loading()"
              (click)="load()"
            >
              {{ loading() ? 'กำลังโหลด…' : '↻ รีเฟรช' }}
            </button>

            <button
              type="button"
              class="btn btn-ghost"
              (click)="logout()"
            >
              เปลี่ยนเลขใบงาน
            </button>
          </div>
        </div>

        @if (!j.route) {
          <p class="card mt-3 p-6 text-center text-sm text-slate-500">
            {{ j.message || 'ยังไม่มีงานที่ได้รับมอบหมาย' }}
          </p>
        } @else {
          <!-- สรุปงาน -->
          <div class="card mt-3 p-5">
            <div class="flex items-end justify-between">
              <div>
                <p class="text-xs text-slate-500">ต้องหยิบข้าวกล่องจากร้าน</p>
                <p class="text-4xl font-bold text-brand-600">
                  {{ totalBoxes() }}
                  <span class="text-lg font-semibold text-slate-600">กล่อง</span>
                </p>
              </div>

              <div class="text-right">
                <p class="text-xs text-slate-500">ส่งแล้ว</p>
                <p class="text-3xl font-bold">
                  {{ done() }}
                  <span class="text-lg text-slate-400">/{{ total() }}</span>
                </p>
              </div>
            </div>

            <div
              class="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuemin="0"
              [attr.aria-valuenow]="done()"
              [attr.aria-valuemax]="total()"
            >
              <div
                class="h-full bg-emerald-500 transition-all"
                [style.width.%]="progress()"
              ></div>
            </div>

            <p class="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">
              {{ summary() }}
            </p>

            <dl class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div class="rounded-lg bg-slate-50 p-2">
                <dt class="text-xs text-slate-500">ระยะทาง</dt>
                <dd class="font-semibold">
                  {{ n(j.route.total_km).toFixed(1) }} กม.
                </dd>
              </div>

              <div class="rounded-lg bg-slate-50 p-2">
                <dt class="text-xs text-slate-500">ถึงจุดสุดท้าย</dt>
                <dd class="font-semibold">
                  {{ j.summary?.last_arrival || '-' }}
                </dd>
              </div>

              <div class="rounded-lg bg-slate-50 p-2">
                <dt class="text-xs text-slate-500">ค่าตอบแทน</dt>
                <dd class="font-semibold">
                  {{ money(j.route.total_cost) }}
                </dd>
              </div>
            </dl>

            <p class="mt-3 text-xs text-slate-500">
              เส้นทาง #{{ j.route.route_id }}
              · จัดเมื่อ {{ date(j.route.created_at) }}
              · ต้องส่งถึงลูกค้าก่อน {{ j.summary?.deadline || '12:30' }}
            </p>

            <a
              class="btn btn-primary mt-3 w-full !py-3 text-base"
              target="_blank"
              rel="noopener"
              [href]="routeUrl()"
            >
              🧭 เปิดแผนที่นำทางทั้งเส้นทาง
            </a>
          </div>

          @if (total() && done() === total()) {
            <p class="mt-3 rounded-xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">
              🎉 ส่งครบทุกออเดอร์แล้ว ขอบคุณครับ
            </p>
          }

          <!-- เช็กลิสต์หยิบของที่ร้าน -->
          <div class="card mt-3 p-4">
            <div class="flex items-center justify-between">
              <p class="font-semibold">🛍️ หยิบของที่ร้าน</p>
              <span class="text-xs text-slate-500">
                หยิบแล้ว {{ pickedCount() }}/{{ total() }}
              </span>
            </div>

            <p class="mb-2 text-xs text-slate-500">
              ติ๊กเมื่อหยิบกล่องของออเดอร์นั้นครบ
            </p>

            <ul class="divide-y divide-slate-100">
              @for (s of stops(); track s.order_id) {
                <li>
                  <label class="flex cursor-pointer items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      class="h-5 w-5 accent-orange-600"
                      [checked]="picked().has(s.order_id)"
                      (change)="togglePick(s.order_id)"
                    />

                    <span
                      class="flex-1 text-sm"
                      [class.line-through]="picked().has(s.order_id)"
                      [class.text-slate-400]="picked().has(s.order_id)"
                    >
                      <b>ออเดอร์ #{{ s.order_id }}</b>
                      · {{ name(s) }}
                    </span>

                    <span class="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-700">
                      {{ s.boxes }} กล่อง
                    </span>
                  </label>
                </li>
              }
            </ul>
          </div>

          <!-- ค้นหาออเดอร์ -->
          <div class="card mt-3 p-4">
            <label class="label" for="q">
              ค้นหาออเดอร์ของฉัน (เลขออเดอร์ / ชื่อ / ที่อยู่)
            </label>

            <input
              id="q"
              class="field"
              name="q"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
              placeholder="เช่น 24 หรือ สมชาย"
              inputmode="search"
              autocomplete="off"
            />

            @if (notMine(); as nm) {
              <p class="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                ออเดอร์ #{{ nm }} ไม่อยู่ในงานของคุณ
                ตรวจเลขอีกครั้ง หรือสอบถามร้านค้า
              </p>
            }
          </div>

          <!-- แท็บกรองรายการ -->
          <div
            class="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1 text-sm font-semibold"
            role="tablist"
          >
            @for (t of tabs; track t.id) {
              <button
                type="button"
                role="tab"
                class="rounded-lg px-2 py-2 transition"
                [attr.aria-selected]="tab() === t.id"
                [class]="tab() === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600'"
                (click)="tab.set(t.id)"
              >
                {{ t.label }} ({{ count(t.id) }})
              </button>
            }
          </div>

          <!-- รายการจุดส่ง -->
          <ol class="mt-3 space-y-3">
            @for (s of visible(); track s.order_id) {
              <li
                class="card p-4"
                [class.ring-2]="s.order_id === nextId()"
                [class.ring-brand-500]="s.order_id === nextId()"
                [class.opacity-60]="s.status === 'delivered'"
              >
                @if (s.order_id === nextId()) {
                  <p class="mb-2 inline-block rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">
                    ▶ จุดถัดไป
                  </p>
                }

                <div class="flex items-start gap-3">
                  <span class="flex h-8 shrink-0 items-center justify-center rounded-full bg-slate-800 px-3 text-sm font-bold text-white">
                    จุดที่ {{ s.seq }}
                  </span>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <p class="font-semibold">{{ name(s) }}</p>
                      <app-status-badge [status]="s.status" />
                    </div>

                    <p class="mt-0.5 text-sm text-slate-600">
                      {{ s.address || '-' }}
                    </p>

                    <p class="mt-2 text-sm font-semibold text-slate-700">
                      ออเดอร์ #{{ s.order_id }} · ส่ง {{ s.boxes }} กล่อง
                    </p>

                    @if (s.delivered_at) {
                      <p
                        class="mt-1 text-xs"
                        [class]="s.on_time === false
                          ? 'font-semibold text-red-600'
                          : 'text-emerald-700'"
                      >
                        ส่งแล้วเวลา {{ time(s.delivered_at) }} น.
                        {{ s.on_time === false ? ' (ช้ากว่า 12:30)' : '' }}
                      </p>
                    }

                    <dl class="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div class="rounded-md bg-slate-50 px-2 py-1">
                        <dt class="text-slate-500">ถึงประมาณ</dt>
                        <dd class="font-semibold text-slate-800">
                          {{ s.arrive_time || '-' }}
                        </dd>
                      </div>

                      <div class="rounded-md bg-slate-50 px-2 py-1">
                        <dt class="text-slate-500">จากจุดก่อน</dt>
                        <dd class="font-semibold text-slate-800">
                          {{ n(s.leg_km).toFixed(1) }} กม.
                        </dd>
                      </div>

                      <div class="rounded-md bg-slate-50 px-2 py-1">
                        <dt class="text-slate-500">ยอดอาหาร</dt>
                        <dd class="font-semibold text-slate-800">
                          {{ money(s.amount) }}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div class="mt-3 grid grid-cols-3 gap-2">
                  <a class="btn btn-ghost" [href]="'tel:' + s.phone">
                    📞 โทร
                  </a>

                  <a
                    class="btn btn-ghost"
                    target="_blank"
                    rel="noopener"
                    [href]="map(s)"
                  >
                    📍 แผนที่
                  </a>

                  @if (confirmId() === s.order_id) {
                    <button
                      type="button"
                      class="btn btn-primary"
                      [disabled]="busyId() === s.order_id"
                      (click)="deliver(s.order_id)"
                    >
                      {{ busyId() === s.order_id ? '…' : 'ยืนยัน ✓' }}
                    </button>
                  } @else {
                    <button
                      type="button"
                      class="btn btn-primary"
                      [disabled]="s.status !== 'assigned'"
                      (click)="confirmId.set(s.order_id)"
                    >
                      {{ s.status === 'delivered' ? 'ส่งแล้ว' : '✓ ส่งแล้ว' }}
                    </button>
                  }
                </div>

                @if (confirmId() === s.order_id) {
                  <p class="mt-2 text-center text-xs text-slate-500">
                    กดยืนยันอีกครั้งว่าส่งออเดอร์ #{{ s.order_id }}
                    ให้ {{ s.first_name }} แล้ว ·
                    <button
                      type="button"
                      class="underline"
                      (click)="confirmId.set(null)"
                    >
                      ยกเลิก
                    </button>
                  </p>
                }
              </li>
            } @empty {
              <li class="card p-6 text-center text-sm text-slate-500">
                {{
                  query()
                    ? 'ไม่พบรายการที่ค้นหา'
                    : tab() === 'todo'
                      ? 'ไม่มีงานค้างส่ง'
                      : 'ยังไม่มีรายการ'
                }}
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
  private router = inject(Router);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'todo', label: 'ต้องส่ง' },
    { id: 'done', label: 'ส่งแล้ว' },
    { id: 'all', label: 'ทั้งหมด' },
  ];

  code = this.saved();

  loading = signal(false);
  busyId = signal<number | null>(null);
  confirmId = signal<number | null>(null);
  error = signal('');
  job = signal<RiderJob | null>(null);
  tab = signal<Tab>('todo');
  query = signal('');
  picked = signal<Set<number>>(new Set());

  stops = computed<RiderStop[]>(() =>
    [...(this.job()?.stops ?? [])].sort((a, b) => a.seq - b.seq)
  );

  total = computed(() => this.stops().length);

  done = computed(() =>
    this.stops().filter(s => s.status === 'delivered').length
  );

  progress = computed(() =>
    this.total() ? (this.done() / this.total()) * 100 : 0
  );

  totalBoxes = computed(() =>
    this.stops().reduce((t, s) => t + num(s.boxes), 0)
  );

  pickedCount = computed(() =>
    this.stops().filter(s => this.picked().has(s.order_id)).length
  );

  summary = computed(() =>
    this.stops()
      .map(s => `จุดที่ ${s.seq} บ้านคุณ${s.first_name}`)
      .join(' → ')
  );

  nextId = computed(() =>
    this.stops().find(s => s.status === 'assigned')?.order_id ?? null
  );

  count = (t: Tab) =>
    t === 'all'
      ? this.total()
      : this.stops().filter(
          s => (t === 'done') === (s.status === 'delivered')
        ).length;

  visible = computed(() => {
    const q = this.query().trim().replace(/^#/, '').toLowerCase();
    const t = this.tab();

    return this.stops().filter(s => {
      if (t === 'todo' && s.status === 'delivered') return false;
      if (t === 'done' && s.status !== 'delivered') return false;
      if (!q) return true;

      return (
        String(s.order_id) === q ||
        String(s.order_id).startsWith(q) ||
        `${s.first_name} ${s.last_name} ${s.address ?? ''}`
          .toLowerCase()
          .includes(q)
      );
    });
  });

  notMine = computed(() => {
    const q = this.query().trim().replace(/^#/, '');

    if (!/^\d+$/.test(q) || !this.total()) return '';

    return this.stops().some(s => String(s.order_id).startsWith(q))
      ? ''
      : q;
  });

  routeUrl = computed(() => {
    const all = this.stops();
    const st = all.filter(s => s.status !== 'delivered');
    const use = st.length ? st : all;

    if (!use.length) return '#';

    const pt = (s: { lat: unknown; lng: unknown }) =>
      `${num(s.lat)},${num(s.lng)}`;

    const last = use[use.length - 1];
    const via = use.slice(0, -1).map(pt).join('|');

    return `https://www.google.com/maps/dir/?api=1&travelmode=motorcycle&destination=${pt(last)}${
      via ? '&waypoints=' + encodeURIComponent(via) : ''
    }`;
  });

  name = fullName;
  n = num;
  money = baht;
  date = fmtDate;
  time = fmtTime;
  map = (s: { lat: unknown; lng: unknown }) => mapsUrl(s.lat, s.lng);

  constructor() {
    if (this.code) this.load();
  }

  /**
   * กลับหน้า Login และล้างเลขใบงานที่จำไว้
   */
  goToLogin() {
    this.logout();
    this.router.navigate(['/login']);
  }

  load() {
    const code = this.code.trim();
    if (!code) return;

    this.loading.set(true);
    this.error.set('');

    this.api.riderJob(code).subscribe({
      next: j => {
        this.code = code;
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

  logout() {
    this.job.set(null);
    this.code = '';
    this.query.set('');
    this.picked.set(new Set());
    this.confirmId.set(null);
    this.error.set('');
    this.remember('');
  }

  togglePick(orderId: number) {
    this.picked.update(p => {
      const next = new Set(p);

      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }

      return next;
    });
  }

  deliver(orderId: number) {
    this.busyId.set(orderId);

    this.api.markDelivered(orderId, this.code.trim()).subscribe({
      next: r => {
        this.job.update(j =>
          j
            ? {
                ...j,
                stops: j.stops?.map(s =>
                  s.order_id === orderId
                    ? {
                        ...s,
                        status: 'delivered' as const,
                        delivered_at:
                          r.delivered_at ?? new Date().toISOString(),
                        on_time: r.on_time ?? null,
                      }
                    : s
                ),
              }
            : j
        );

        this.busyId.set(null);
        this.confirmId.set(null);
        this.toast.ok(`ส่งออเดอร์ #${orderId} เรียบร้อย`);
      },
      error: e => {
        this.busyId.set(null);
        this.confirmId.set(null);
        this.toast.error(errorText(e));
      },
    });
  }

  private saved(): string {
    try {
      return typeof localStorage !== 'undefined'
        ? (localStorage.getItem(STORAGE_KEY) ?? '')
        : '';
    } catch {
      return '';
    }
  }

  private remember(code: string) {
    try {
      if (code) {
        localStorage.setItem(STORAGE_KEY, code);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ไม่เป็นไรถ้าบันทึกไม่ได้
    }
  }
}
