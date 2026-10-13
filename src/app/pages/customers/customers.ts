import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ApiService, errorText } from '../../core/api.service';
import { Customer } from '../../core/models';
import { fullName, mapsUrl, num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { Modal } from '../../shared/modal';
import { MapPin, MapPoint, RouteMap } from '../../shared/route-map';

interface CustomerForm {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

const emptyForm = (): CustomerForm => ({ first_name: '', last_name: '', phone: '', address: '', lat: null, lng: null });

@Component({
  selector: 'app-customers',
  imports: [FormsModule, Modal, RouteMap],
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold">ลูกค้า</h1>
        <p class="text-sm text-slate-500">{{ shown().length }} รายการ{{ mode() === 'nearby' ? ' (ในรัศมี 1 กม.)' : '' }}</p>
      </div>
      <div class="flex gap-2">
        <div class="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-medium" role="tablist" aria-label="มุมมอง">
          <button type="button" role="tab" [attr.aria-selected]="view() === 'list'" class="rounded-lg px-3 py-1.5" [class]="view() === 'list' ? 'bg-white shadow-sm' : 'text-slate-600'" (click)="view.set('list')">☰ รายการ</button>
          <button type="button" role="tab" [attr.aria-selected]="view() === 'map'" class="rounded-lg px-3 py-1.5" [class]="view() === 'map' ? 'bg-white shadow-sm' : 'text-slate-600'" (click)="view.set('map')">📍 แผนที่</button>
        </div>
        <button type="button" class="btn btn-primary" (click)="openCreate()">+ เพิ่มลูกค้า</button>
      </div>
    </div>

    <!-- ค้นหา -->
    <div class="card mb-4 grid gap-3 p-4 md:grid-cols-2">
      <form class="flex gap-2" (ngSubmit)="search()">
        <input class="field" name="q" [(ngModel)]="query" placeholder="ค้นหาจากชื่อหรือนามสกุล" aria-label="ค้นหาลูกค้า" />
        <button class="btn btn-ghost" type="submit">ค้นหา</button>
      </form>
      <form class="flex gap-2" (ngSubmit)="nearby()">
        <input class="field" name="nlat" type="number" step="any" [(ngModel)]="nearLat" placeholder="ละติจูด" aria-label="ละติจูด" />
        <input class="field" name="nlng" type="number" step="any" [(ngModel)]="nearLng" placeholder="ลองจิจูด" aria-label="ลองจิจูด" />
        <button class="btn btn-ghost" type="submit">ใกล้เคียง</button>
      </form>
      @if (mode() !== 'all') {
        <div class="md:col-span-2">
          <button type="button" class="text-sm font-medium text-brand-600 hover:underline" (click)="reset()">× ล้างตัวกรอง แสดงทั้งหมด</button>
        </div>
      }
    </div>

    @if (view() === 'map') {
      <div class="card p-4">
        <p class="mb-3 text-xs text-slate-500">หมุดส้มคือบ้านลูกค้า ({{ pins().length }} หลัง) · แตะหมุดเพื่อดูชื่อ เบอร์ และที่อยู่</p>
        <app-route-map [pins]="pins()" height="min(70vh, 36rem)" />
      </div>
    } @else {
    <div class="card overflow-hidden">
      @if (loading()) {
        <div class="space-y-2 p-4">
          @for (i of [1, 2, 3, 4, 5]; track i) {
            <div class="skeleton h-10"></div>
          }
        </div>
      } @else if (!shown().length) {
        <p class="py-14 text-center text-sm text-slate-500">ไม่พบลูกค้า</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px]">
            <thead>
              <tr>
                <th class="th">#</th>
                <th class="th">ชื่อ</th>
                <th class="th">เบอร์โทร</th>
                <th class="th">ที่อยู่</th>
                <th class="th">พิกัด</th>
                <th class="th"></th>
              </tr>
            </thead>
            <tbody>
              @for (c of shown(); track c.id) {
                <tr class="hover:bg-slate-50">
                  <td class="td text-slate-500">{{ c.id }}</td>
                  <td class="td font-medium">{{ name(c) }}</td>
                  <td class="td">{{ c.phone }}</td>
                  <td class="td max-w-[240px] truncate text-slate-600" [title]="c.address">{{ c.address || '-' }}</td>
                  <td class="td text-xs">
                    <a class="text-brand-600 hover:underline" target="_blank" rel="noopener" [href]="map(c)">{{ n(c.lat).toFixed(4) }}, {{ n(c.lng).toFixed(4) }}</a>
                    @if (c.distance_km !== undefined) {
                      <span class="ml-1 text-slate-500">· {{ n(c.distance_km).toFixed(2) }} กม.</span>
                    }
                  </td>
                  <td class="td whitespace-nowrap text-right">
                    <button type="button" class="btn btn-ghost !px-2.5 !py-1" (click)="openEdit(c)">แก้ไข</button>
                    <button type="button" class="btn btn-danger !px-2.5 !py-1" (click)="askDelete(c)">ลบ</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
    }

    <!-- ฟอร์มเพิ่ม/แก้ไข -->
    <app-modal [open]="formOpen()" [title]="editingId() ? 'แก้ไขลูกค้า #' + editingId() : 'เพิ่มลูกค้า'" (closed)="formOpen.set(false)">
      <form class="space-y-3" (ngSubmit)="save()" #f="ngForm">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="fn">ชื่อ</label>
            <input id="fn" class="field" name="first_name" [(ngModel)]="form.first_name" required />
          </div>
          <div>
            <label class="label" for="ln">นามสกุล</label>
            <input id="ln" class="field" name="last_name" [(ngModel)]="form.last_name" required />
          </div>
        </div>
        <div>
          <label class="label" for="ph">เบอร์โทร</label>
          <input id="ph" class="field" name="phone" [(ngModel)]="form.phone" required inputmode="tel" />
        </div>
        <div>
          <label class="label" for="ad">ที่อยู่</label>
          <textarea id="ad" class="field" rows="2" name="address" [(ngModel)]="form.address"></textarea>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="label !mb-0">ตำแหน่งบ้าน — คลิกบนแผนที่ หรือลากหมุดสีแดง</span>
            <button type="button" class="shrink-0 text-xs font-medium text-brand-600 hover:underline" (click)="useMyLocation()">📍 ใช้ตำแหน่งของฉัน</button>
          </div>
          <app-route-map [pickable]="true" [picked]="pickPoint()" (pick)="onPick($event)" height="14rem" />
          @if (!pickPoint()) {
            <p class="mt-1 text-xs text-amber-700">ยังไม่ได้เลือกตำแหน่ง — แตะบนแผนที่ตรงบ้านลูกค้า</p>
          }
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="la">ละติจูด</label>
            <input id="la" class="field" type="number" step="any" min="-90" max="90" name="lat" [ngModel]="form.lat" (ngModelChange)="setLat($event)" required />
          </div>
          <div>
            <label class="label" for="lo">ลองจิจูด</label>
            <input id="lo" class="field" type="number" step="any" min="-180" max="180" name="lng" [ngModel]="form.lng" (ngModelChange)="setLng($event)" required />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="btn btn-ghost" (click)="formOpen.set(false)">ยกเลิก</button>
          <button type="submit" class="btn btn-primary" [disabled]="f.invalid || saving()">{{ saving() ? 'กำลังบันทึก…' : 'บันทึก' }}</button>
        </div>
      </form>
    </app-modal>

    <!-- ยืนยันลบ -->
    <app-modal [open]="!!deleting()" title="ลบลูกค้า?" (closed)="deleting.set(null)">
      @if (deleting(); as d) {
        <p class="text-sm text-slate-600">ต้องการลบ <b>{{ name(d) }}</b> ใช่หรือไม่? หากลูกค้ามีออเดอร์อยู่ อาจลบไม่ได้</p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" (click)="deleting.set(null)">ยกเลิก</button>
          <button type="button" class="btn btn-primary !bg-red-600" [disabled]="saving()" (click)="confirmDelete()">ลบ</button>
        </div>
      }
    </app-modal>
  `,
})
export class Customers implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  all = signal<Customer[]>([]);
  filtered = signal<Customer[] | null>(null);
  mode = signal<'all' | 'search' | 'nearby'>('all');
  shown = computed(() => this.filtered() ?? this.all());
  view = signal<'list' | 'map'>('list');
  pins = computed<MapPin[]>(() =>
    this.shown().map(c => ({ lat: num(c.lat), lng: num(c.lng), title: fullName(c), detail: [c.phone, c.address].filter(Boolean).join(' · ') })),
  );

  query = '';
  nearLat: number | null = null;
  nearLng: number | null = null;

  formOpen = signal(false);
  editingId = signal<number | null>(null);
  form: CustomerForm = emptyForm();
  /** ตำแหน่งที่เลือกบนแผนที่ในฟอร์ม (ซิงก์กับช่องละติจูด/ลองจิจูด) */
  pickPoint = signal<MapPoint | null>(null);
  deleting = signal<Customer | null>(null);

  name = fullName;
  n = num;
  map = (c: Customer) => mapsUrl(c.lat, c.lng);

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.customers().subscribe({
      next: list => {
        this.all.set(list);
        this.loading.set(false);
      },
      error: e => {
        this.toast.error(errorText(e));
        this.loading.set(false);
      },
    });
  }

  search() {
    const q = this.query.trim();
    if (!q) return this.reset();
    this.loading.set(true);
    this.api.searchCustomers(q).subscribe({
      next: list => {
        this.filtered.set(list);
        this.mode.set('search');
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
    this.loading.set(true);
    this.api.nearbyCustomers(this.nearLat, this.nearLng).subscribe({
      next: list => {
        this.filtered.set(list);
        this.mode.set('nearby');
        this.loading.set(false);
      },
      error: e => {
        this.toast.error(errorText(e));
        this.loading.set(false);
      },
    });
  }

  reset() {
    this.query = '';
    this.filtered.set(null);
    this.mode.set('all');
  }

  openCreate() {
    this.editingId.set(null);
    this.form = emptyForm();
    this.pickPoint.set(null);
    this.formOpen.set(true);
  }

  openEdit(c: Customer) {
    this.editingId.set(c.id);
    this.form = {
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      address: c.address ?? '',
      lat: num(c.lat),
      lng: num(c.lng),
    };
    this.syncPick();
    this.formOpen.set(true);
  }

  onPick(p: MapPoint) {
    this.form.lat = p.lat;
    this.form.lng = p.lng;
    this.pickPoint.set(p);
  }

  setLat(v: number | null) {
    this.form.lat = v;
    this.syncPick();
  }

  setLng(v: number | null) {
    this.form.lng = v;
    this.syncPick();
  }

  private syncPick() {
    const { lat, lng } = this.form;
    const ok = lat !== null && lng !== null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
    this.pickPoint.set(ok ? { lat: Number(lat), lng: Number(lng) } : null);
  }

  useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.toast.error('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => this.onPick({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }),
      () => this.toast.error('ขอตำแหน่งไม่สำเร็จ (ตรวจสอบว่าอนุญาตการเข้าถึงตำแหน่งแล้ว)'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  save() {
    const body = { ...this.form, lat: Number(this.form.lat), lng: Number(this.form.lng) };
    const id = this.editingId();
    this.saving.set(true);
    const req: Observable<unknown> = id ? this.api.updateCustomer(id, body) : this.api.createCustomer(body);
    req.subscribe({
      next: () => {
        this.toast.ok(id ? 'แก้ไขลูกค้าแล้ว' : 'เพิ่มลูกค้าแล้ว');
        this.saving.set(false);
        this.formOpen.set(false);
        this.reset();
        this.load();
      },
      error: e => {
        this.toast.error(errorText(e));
        this.saving.set(false);
      },
    });
  }

  askDelete(c: Customer) {
    this.deleting.set(c);
  }

  confirmDelete() {
    const c = this.deleting();
    if (!c) return;
    this.saving.set(true);
    this.api.deleteCustomer(c.id).subscribe({
      next: () => {
        this.toast.ok('ลบลูกค้าแล้ว');
        this.saving.set(false);
        this.deleting.set(null);
        this.reset();
        this.load();
      },
      error: e => {
        this.toast.error(errorText(e));
        this.saving.set(false);
        this.deleting.set(null);
      },
    });
  }
}
