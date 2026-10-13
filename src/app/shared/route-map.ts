import { Component, ElementRef, OnDestroy, afterNextRender, computed, effect, input, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';

export interface MapStop {
  lat: number;
  lng: number;
  seq: number;
  label?: string;
}

export interface MapRoute {
  name: string;
  stops: MapStop[];
}

export interface MapPin {
  lat: number;
  lng: number;
  title: string;
  detail?: string;
}

/** สีเส้นทางไรเดอร์: คนที่ 1 แดง, คนที่ 2 เขียว, คนที่ 3 น้ำเงิน ตามที่เจ้าของร้านกำหนด */
export const ROUTE_COLORS = ['#dc2626', '#16a34a', '#2563eb', '#9333ea', '#ea580c', '#0d9488', '#ca8a04', '#db2777'];
export const ROUTE_COLOR_NAMES = ['แดง', 'เขียว', 'น้ำเงิน', 'ม่วง', 'ส้ม', 'เขียวเทา', 'เหลืองเข้ม', 'ชมพู'];

interface RoadResult {
  coords: [number, number][];
  km: number;
  min: number;
}

// เก็บผลไว้ ไม่ต้องขอซ้ำเมื่อสลับไปมาระหว่างตัวเลือกเส้นทาง
const roadCache = new Map<string, RoadResult>();

/** ขอเส้นทางถนนจริงจาก OSRM (เซิร์ฟเวอร์สาธารณะฟรี โปรไฟล์รถยนต์) คืน null ถ้าขอไม่ได้ */
async function fetchRoad(pts: Leaflet.LatLngTuple[]): Promise<RoadResult | null> {
  const path = pts.map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join(';');
  const hit = roadCache.get(path);
  if (hit) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    if (j.code !== 'Ok' || !j.routes?.length) return null;
    const out: RoadResult = {
      coords: j.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]),
      km: j.routes[0].distance / 1000,
      min: j.routes[0].duration / 60,
    };
    roadCache.set(path, out);
    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * แผนที่จริง (OpenStreetMap + Leaflet)
 * - ใส่ [routes] เพื่อวาดเส้นทางไรเดอร์แต่ละคนคนละสี (เริ่มจากร้าน)
 * - ใส่ [pins] เพื่อปักหมุดบ้านลูกค้า
 * Leaflet แตะ window จึงโหลดเฉพาะฝั่งเบราว์เซอร์เท่านั้น (รองรับ SSR)
 */
@Component({
  selector: 'app-route-map',
  template: `
    <div class="relative isolate">
      <div #host class="w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200" [style.height]="height()" role="region" aria-label="แผนที่"></div>
      @if (!ready()) {
        <div class="skeleton absolute inset-0 grid place-items-center text-sm text-slate-500">กำลังโหลดแผนที่…</div>
      }
    </div>
    @if (routes().length) {
      <p class="mt-2 text-xs text-slate-500">
        @switch (roadState()) {
          @case ('loading') { กำลังโหลดเส้นทางตามถนนจริง… (เส้นประคือระยะตรงชั่วคราว) }
          @case ('ok') { เส้นทึบคือเส้นทางตามถนนจริง (ข้อมูล OSRM / OpenStreetMap, เวลาคิดแบบรถยนต์) }
          @case ('fail') { โหลดถนนจริงไม่สำเร็จบางเส้น เส้นประคือระยะตรง }
        }
      </p>
      <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-700">
        @for (r of legend(); track $index; let i = $index) {
          <li class="flex items-center gap-2">
            <span class="inline-block h-1.5 w-6 rounded-full" [style.background]="r.color"></span>{{ r.name }} <span class="text-slate-400">({{ r.colorName }})</span>
            @if (roads()[i]; as rd) {
              <span class="text-xs text-slate-500">· ถนนจริง {{ rd.km.toFixed(1) }} กม. ~{{ rd.min.toFixed(0) }} นาที</span>
            }
          </li>
        }
        @if (shop()) {
          <li class="flex items-center gap-2"><span class="inline-block h-3.5 w-3.5 rounded bg-slate-900"></span>ร้าน</li>
        }
      </ul>
    }
  `,
})
export class RouteMap implements OnDestroy {
  shop = input<{ lat: number; lng: number } | null>(null);
  routes = input<MapRoute[]>([]);
  pins = input<MapPin[]>([]);
  height = input('28rem');

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  protected ready = signal(false);
  protected roads = signal<Record<number, { km: number; min: number }>>({});
  protected roadState = signal<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  private drawToken = 0;

  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layer?: Leaflet.LayerGroup;

  protected legend = computed(() =>
    this.routes().map((r, i) => ({
      name: r.name,
      color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      colorName: ROUTE_COLOR_NAMES[i % ROUTE_COLOR_NAMES.length],
    })),
  );

  constructor() {
    afterNextRender(async () => {
      const mod: any = await import('leaflet');
      this.L = (mod.default ?? mod) as typeof Leaflet;
      this.map = this.L.map(this.host().nativeElement, { scrollWheelZoom: false }).setView([16.2467, 103.2528], 13);
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.layer = this.L.layerGroup().addTo(this.map);
      this.ready.set(true);
    });

    // วาดใหม่ทุกครั้งที่ข้อมูลเปลี่ยน
    effect(() => {
      const ready = this.ready();
      const shop = this.shop();
      const routes = this.routes();
      const pins = this.pins();
      if (!ready || !this.L || !this.map || !this.layer) return;
      this.draw(shop, routes, pins);
    });
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private draw(shop: { lat: number; lng: number } | null, routes: MapRoute[], pins: MapPin[]) {
    const L = this.L!;
    const map = this.map!;
    this.layer!.clearLayers();
    const token = ++this.drawToken;
    this.roads.set({});
    const jobs: { line: Leaflet.Polyline; pts: Leaflet.LatLngTuple[]; i: number }[] = [];
    const bounds: Leaflet.LatLngTuple[] = [];

    routes.forEach((r, i) => {
      const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
      const pts: Leaflet.LatLngTuple[] = [
        ...(shop ? [[shop.lat, shop.lng] as Leaflet.LatLngTuple] : []),
        ...r.stops.map(s => [s.lat, s.lng] as Leaflet.LatLngTuple),
      ];
      // เส้นประ = ระยะตรงชั่วคราว จะถูกแทนด้วยเส้นตามถนนจริงเมื่อโหลดเสร็จ
      const line = L.polyline(pts, { color, weight: 5, opacity: 0.9, lineJoin: 'round', dashArray: pts.length > 1 ? '4 8' : undefined }).addTo(this.layer!);
      if (pts.length > 1) jobs.push({ line, pts, i });
      for (const s of r.stops) {
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: '',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            html: `<div style="width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:grid;place-items:center;font:700 13px 'Noto Sans Thai',sans-serif">${s.seq}</div>`,
          }),
        })
          .bindPopup(`<b>${esc(r.name)}</b> · จุดที่ ${s.seq}${s.label ? `<br>${esc(s.label)}` : ''}`)
          .addTo(this.layer!);
        bounds.push([s.lat, s.lng]);
      }
    });

    for (const p of pins) {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: '',
          iconSize: [26, 34],
          iconAnchor: [13, 34],
          html: `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.5 13 33 13 33s12-11.5 12-20.3C25 6.2 19.6 1 13 1z" fill="#ea580c" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>`,
        }),
      })
        .bindPopup(`<b>${esc(p.title)}</b>${p.detail ? `<br>${esc(p.detail)}` : ''}`)
        .addTo(this.layer!);
      bounds.push([p.lat, p.lng]);
    }

    if (shop) {
      L.marker([shop.lat, shop.lng], {
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: '',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          html: `<div style="width:34px;height:34px;border-radius:8px;background:#0f172a;color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5);display:grid;place-items:center;font:700 11px 'Noto Sans Thai',sans-serif">ร้าน</div>`,
        }),
      })
        .bindPopup('<b>ร้านข้าวกล่อง</b> (จุดเริ่มต้น)')
        .addTo(this.layer!);
      bounds.push([shop.lat, shop.lng]);
    }

    if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    setTimeout(() => map.invalidateSize(), 0);

    if (jobs.length) void this.loadRoads(jobs, token);
    else this.roadState.set('idle');
  }

  /** ขอถนนจริงทีละเส้น (เซิร์ฟเวอร์ฟรีจำกัดความถี่) แล้วค่อยๆ แทนเส้นตรง */
  private async loadRoads(jobs: { line: Leaflet.Polyline; pts: Leaflet.LatLngTuple[]; i: number }[], token: number) {
    this.roadState.set('loading');
    let failed = 0;
    for (const j of jobs) {
      if (token !== this.drawToken) return;
      const road = await fetchRoad(j.pts);
      if (token !== this.drawToken) return;
      if (!road) {
        failed++;
        continue;
      }
      j.line.setLatLngs(road.coords);
      j.line.setStyle({ dashArray: undefined });
      this.roads.update(r => ({ ...r, [j.i]: { km: road.km, min: road.min } }));
    }
    this.roadState.set(failed ? 'fail' : 'ok');
  }
}