import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiService, errorText } from '../../core/api.service';
import { Customer, Order, OrderStatus } from '../../core/models';
import { fmtDate, fullName, num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { Modal } from '../../shared/modal';
import { StatusBadge } from '../../shared/status-badge';

type Filter = 'all' | OrderStatus;

@Component({
  selector: 'app-orders',
  imports: [FormsModule, Modal, StatusBadge],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">ออเดอร์</h1>
        <p class="text-sm text-slate-500">{{ shown().length }} รายการ{{ nearbyMode() ? ' (ในรัศมี 2 กม.)' : '' }} · ไรเดอร์รับได้คนละไม่เกิน 3 ออเดอร์</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-ghost" [disabled]="busy()" (click)="simulate()">⚡ จำลอง 20–30 ออเดอร์</button>
        <button type="button" class="btn btn-danger" [disabled]="busy() || !orders().length" (click)="clearOpen.set(true)">ล้างทั้งหมด</button>
        <button type="button" class="btn btn-primary" (click)="openCreate()">+ เพิ่มออเดอร์</button>
      </div>
    </div>

    <div class="card mb-4 space-y-3 p-4">
      <div class="flex flex-wrap items-center gap-2">
        @for (t of tabs; track t.key) {
          <button
            type="button"
            class="rounded-full px-3.5 py-1.5 text-sm font-medium"
            [class]="filter() === t.key ? 'bg-ink text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            (click)="filter.set(t.key)"
          >
            {{ t.label }} <span class="opacity-70">{{ counts()[t.key] }}</span>
          </button>
        }
        <input class="field ml-auto !w-full sm:!w-64" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="เลขออเดอร์ / ค้นหาชื่อ / เบอร์ / " aria-label="ค้นหาออเดอร์" />
      </div>
      <form class="flex flex-wrap gap-2" (ngSubmit)="nearby()">
        <input class="field !w-40" name="nlat" type="number" step="any" [(ngModel)]="nearLat" placeholder="ละติจูด" aria-label="ละติจูด" />
        <input class="field !w-40" name="nlng" type="number" step="any" [(ngModel)]="nearLng" placeholder="ลองจิจูด" aria-label="ลองจิจูด" />
        <button class="btn btn-ghost" type="submit">ค้นออเดอร์ใกล้เคียง (ภายในระยะ 2 กม.)</button>
        @if (nearbyMode()) {
          <button type="button" class="text-sm font-medium text-brand-600 hover:underline" (click)="clearNearby()">× ล้างตัวกรอง</button>
        }
      </form>
    </div>

    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="space-y-2 p-4">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="skeleton h-10"></div>
          }
        </div>
      } @else if (!shown().length) {
        <div class="py-14 text-center">
          <p class="text-sm text-slate-500">ไม่มีออเดอร์ที่ตรงกับเงื่อนไข</p>
          @if (!orders().length) {
            <button type="button" class="btn btn-primary mt-4" (click)="simulate()">⚡ สร้างออเดอร์ตัวอย่าง</button>
          }
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px]">
            <thead>
              <tr>
                <th class="th">#</th>
                <th class="th">ลูกค้า</th>
                <th class="th">ที่อยู่</th>
                <th class="th">กล่อง</th>
                <th class="th">สถานะ</th>
                <th class="th">สร้างเมื่อ</th>
                <th class="th"></th>
              </tr>
            </thead>
            <tbody>
              @for (o of shown(); track o.id) {
                <tr class="hover:bg-slate-50">
                  <td class="td text-slate-500">{{ o.id }}</td>
                  <td class="td">
                    <p class="font-medium">{{ name(o) }}</p>
                    <p class="text-xs text-slate-500">{{ o.phone }}</p>
                  </td>
                  <td class="td max-w-[220px] truncate text-slate-600" [title]="o.address">
                    {{ o.address || '-' }}
                    @if (o.distance_km !== undefined) {
                      <span class="text-xs text-slate-500"> · {{ n(o.distance_km).toFixed(2) }} กม.</span>
                    }
                  </td>
                  <td class="td font-semibold">{{ o.boxes }}</td>
                  <td class="td"><app-status-badge [status]="o.status" /></td>
                  <td class="td whitespace-nowrap text-xs text-slate-500">{{ date(o.created_at) }}</td>
                  <td class="td whitespace-nowrap text-right">
                    <button type="button" class="btn btn-ghost !px-2.5 !py-1" (click)="openEdit(o)">แก้ไข</button>
                    <button type="button" class="btn btn-danger !px-2.5 !py-1" (click)="remove(o)">ลบ</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- เพิ่ม/แก้ไข -->
    <app-modal [open]="formOpen()" [title]="editing() ? 'แก้ไขออเดอร์ #' + editing()!.id : 'เพิ่มออเดอร์'" (closed)="formOpen.set(false)">
      <form class="space-y-3" (ngSubmit)="save()" #f="ngForm">
        @if (!editing()) {
          <div>
            <label class="label" for="cu">ลูกค้า</label>
            <select id="cu" class="field" name="customer_id" [(ngModel)]="formCustomer" required>
              <option [ngValue]="null" disabled>เลือกลูกค้า…</option>
              @for (c of customers(); track c.id) {
                <option [ngValue]="c.id">{{ c.id }} · {{ cname(c) }}</option>
              }
            </select>
          </div>
        } @else {
          <p class="text-sm text-slate-600">ลูกค้า: <b>{{ name(editing()!) }}</b></p>
        }
        <div>
          <span class="label">จำนวนกล่อง (1–3)</span>
          <div class="flex gap-2">
            @for (b of [1, 2, 3]; track b) {
              <button
                type="button"
                class="h-11 flex-1 rounded-lg text-base font-semibold"
                [class]="formBoxes === b ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'"
                (click)="formBoxes = b"
              >
                {{ b }}
              </button>
            }
          </div>
        </div>
        @if (editing()) {
          <div>
            <label class="label" for="st">สถานะ</label>
            <select id="st" class="field" name="status" [(ngModel)]="formStatus">
              <option value="pending">รอจัดส่ง</option>
              <option value="assigned">กำลังส่ง</option>
              <option value="delivered">ส่งแล้ว</option>
            </select>
          </div>
        }
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" [disabled]="(!editing() && formCustomer === null) || busy()">{{ busy() ? 'กำลังบันทึก…' : 'บันทึก' }}</button>
        </div>
      </form>
    </app-modal>

    <!-- ล้างทั้งหมด -->
    <app-modal [open]="clearOpen()" title="ล้างออเดอร์ทั้งหมด?" (closed)="clearOpen.set(false)">
      <p class="text-sm text-slate-600">จะลบออเดอร์ทั้งหมด {{ orders().length }} รายการ ย้อนกลับไม่ได้ (ใช้สำหรับล้างข้อมูลทดสอบ)</p>
      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost" (click)="clearOpen.set(false)">ยกเลิก</button>
        <button type="button" class="btn btn-primary !bg-red-600" [disabled]="busy()" (click)="clearAll()">ล้างทั้งหมด</button>
      </div>
    </app-modal>
  `,
})
export class Orders implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  busy = signal(false);
  orders = signal<Order[]>([]);
  customers = signal<Customer[]>([]);
  nearbyList = signal<Order[] | null>(null);
  nearbyMode = computed(() => this.nearbyList() !== null);
  filter = signal<Filter>('all');
  search = signal('');
  nearLat: number | null = null;
  nearLng: number | null = null;

  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'pending', label: 'รอจัดส่ง' },
    { key: 'assigned', label: 'กำลังส่ง' },
    { key: 'delivered', label: 'ส่งแล้ว' },
  ];

  private source = computed(() => this.nearbyList() ?? this.orders());

  counts = computed(() => {
    const c: Record<Filter, number> = { all: 0, pending: 0, assigned: 0, delivered: 0 };
    for (const o of this.source()) {
      c.all++;
      c[o.status]++;
    }
    return c;
  });

  shown = computed(() => {
    const f = this.filter();
    const q = this.search().trim().toLowerCase();
    return this.source().filter(o => {
      if (f !== 'all' && o.status !== f) return false;
      if (!q) return true;
      return `${o.id} ${o.first_name} ${o.last_name} ${o.phone}`.toLowerCase().includes(q);
    });
  });

  formOpen = signal(false);
  clearOpen = signal(false);
  editing = signal<Order | null>(null);
  formCustomer: number | null = null;
  formBoxes = 1;
  formStatus: OrderStatus = 'pending';

  name = fullName;
  cname = fullName;
  date = fmtDate;
  n = num;

  ngOnInit() {
    this.load();
    this.api.customers().subscribe({ next: c => this.customers.set(c), error: () => {} });
  }

  load() {
    this.loading.set(true);
    this.api.orders().subscribe({
      next: list => {
        this.orders.set(list);
        this.loading.set(false);
      },
      error: e => {
        this.toast.error(errorText(e));
        this.loading.set(false);
      },
    });
  }

  nearby() {
    if (this.nearLat === null || this.nearLng === null) {
      this.toast.error('กรอกละติจูดและลองจิจูดก่อน');
      return;
    }
    this.api.nearbyOrders(this.nearLat, this.nearLng).subscribe({
      next: list => this.nearbyList.set(list),
      error: e => this.toast.error(errorText(e)),
    });
  }

  clearNearby() {
    this.nearbyList.set(null);
  }

  simulate() {
    this.busy.set(true);
    this.api.simulateOrders().subscribe({
      next: r => {
        this.toast.ok(`สร้างออเดอร์ตัวอย่าง ${r.affected_row} รายการ`);
        this.busy.set(false);
        this.load();
      },
      error: e => {
        this.toast.error(errorText(e));
        this.busy.set(false);
      },
    });
  }

  openCreate() {
    this.editing.set(null);
    this.formCustomer = null;
    this.formBoxes = 1;
    this.formOpen.set(true);
  }

  openEdit(o: Order) {
    this.editing.set(o);
    this.formBoxes = o.boxes;
    this.formStatus = o.status;
    this.formOpen.set(true);
  }

  save() {
    const editing = this.editing();
    this.busy.set(true);
    const req: Observable<unknown> = editing
      ? this.api.updateOrder(editing.id, { boxes: this.formBoxes, status: this.formStatus })
      : this.api.createOrder(this.formCustomer as number, this.formBoxes);
    req.subscribe({
      next: () => {
        this.toast.ok(editing ? 'แก้ไขออเดอร์แล้ว' : 'เพิ่มออเดอร์แล้ว');
        this.busy.set(false);
        this.formOpen.set(false);
        this.nearbyList.set(null);
        this.load();
      },
      error: e => {
        this.toast.error(errorText(e));
        this.busy.set(false);
      },
    });
  }

  remove(o: Order) {
    this.api.deleteOrder(o.id).subscribe({
      next: () => {
        this.toast.ok(`ลบออเดอร์ #${o.id} แล้ว`);
        this.nearbyList.set(null);
        this.load();
      },
      error: e => this.toast.error(errorText(e)),
    });
  }

  clearAll() {
    this.busy.set(true);
    this.api.clearOrders().subscribe({
      next: () => {
        this.toast.ok('ล้างออเดอร์ทั้งหมดแล้ว');
        this.busy.set(false);
        this.clearOpen.set(false);
        this.nearbyList.set(null);
        this.load();
      },
      error: e => {
        this.toast.error(errorText(e));
        this.busy.set(false);
      },
    });
  }
}
