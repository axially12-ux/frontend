import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorText } from '../../core/api.service';
import { num } from '../../core/format';
import { ToastService } from '../../core/toast.service';
import { MapPoint, RouteMap } from '../../shared/route-map';

@Component({
  selector: 'app-shop',
  imports: [FormsModule, RouteMap],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold">ตั้งค่าร้าน</h1>
      <p class="text-sm text-slate-500">ตำแหน่งร้านคือจุดเริ่มต้นของทุกเส้นทาง ใช้คำนวณระยะทาง เวลา และค่าไรเดอร์</p>
    </div>

    @if (loading()) {
      <div class="skeleton h-80"></div>
    } @else {
      <div class="grid gap-4 lg:grid-cols-5">
        <div class="card p-4 lg:col-span-3">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h2 class="font-semibold">ตำแหน่งร้าน</h2>
            <button type="button" class="text-xs font-medium text-brand-600 hover:underline" (click)="useMyLocation()">📍 ใช้ตำแหน่งของฉัน</button>
          </div>
          <app-route-map [pickable]="true" [picked]="point()" (pick)="onPick($event)" height="min(60vh, 28rem)" />
          <p class="mt-2 text-xs text-slate-500">คลิกบนแผนที่ หรือลากหมุดสีแดงไปยังตำแหน่งร้าน</p>
        </div>

        <form class="card space-y-3 self-start p-5 lg:col-span-2" (ngSubmit)="save()" #f="ngForm">
          <div>
            <label class="label" for="nm">ชื่อร้าน</label>
            <input id="nm" class="field" name="name" [(ngModel)]="name" required maxlength="100" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label" for="la">ละติจูด</label>
              <input id="la" class="field" type="number" step="any" min="-90" max="90" name="lat" [ngModel]="lat" (ngModelChange)="setLat($event)" required />
            </div>
            <div>
              <label class="label" for="lo">ลองจิจูด</label>
              <input id="lo" class="field" type="number" step="any" min="-180" max="180" name="lng" [ngModel]="lng" (ngModelChange)="setLng($event)" required />
            </div>
          </div>
          <button type="submit" class="btn btn-primary w-full" [disabled]="f.invalid || saving()">{{ saving() ? 'กำลังบันทึก…' : 'บันทึกข้อมูลร้าน' }}</button>
          <p class="text-xs text-slate-500">เส้นทางที่บันทึกไว้แล้วจะไม่เปลี่ยน การจัดเส้นทางครั้งต่อไปจะใช้ตำแหน่งใหม่</p>
        </form>
      </div>
    }
  `,
})
export class ShopPage implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  loading = signal(true);
  saving = signal(false);
  point = signal<MapPoint | null>(null);
  name = 'ร้านข้าวกล่องเดลิเวอรี';
  lat: number | null = null;
  lng: number | null = null;

  ngOnInit() {
    this.api.shop().subscribe({
      next: s => {
        if (s) {
          this.name = s.name;
          this.lat = num(s.lat);
          this.lng = num(s.lng);
          this.sync();
        }
        this.loading.set(false);
      },
      error: e => {
        this.toast.error(errorText(e));
        this.loading.set(false);
      },
    });
  }

  onPick(p: MapPoint) {
    this.lat = p.lat;
    this.lng = p.lng;
    this.point.set(p);
  }

  setLat(v: number | null) {
    this.lat = v;
    this.sync();
  }

  setLng(v: number | null) {
    this.lng = v;
    this.sync();
  }

  private sync() {
    const ok = this.lat !== null && this.lng !== null && Number.isFinite(Number(this.lat)) && Number.isFinite(Number(this.lng)) && Math.abs(Number(this.lat)) <= 90 && Math.abs(Number(this.lng)) <= 180;
    this.point.set(ok ? { lat: Number(this.lat), lng: Number(this.lng) } : null);
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
    this.saving.set(true);
    this.api.saveShop({ name: this.name.trim(), lat: Number(this.lat), lng: Number(this.lng) }).subscribe({
      next: () => {
        this.toast.ok('บันทึกข้อมูลร้านแล้ว');
        this.saving.set(false);
      },
      error: e => {
        this.toast.error(errorText(e));
        this.saving.set(false);
      },
    });
  }
}
