import { Component, ElementRef, OnDestroy, afterNextRender, computed, effect, input, output, signal, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';

export interface MapStop {
  lat: number;
  lng: number;
  seq: number;
  label?: string;
  /** เลขออเดอร์ (แสดงบนหมุดเมื่อเปิด [showOrderNo]) */
  orderId?: number;
}

export interface MapRoute {
  name: string;
  stops: MapStop[];
  /** ลำดับสี (เช่น rider_id) ถ้าไม่ใส่จะใช้ลำดับของเส้นในรายการ */
  colorIndex?: number;
}

export interface MapPin {
  lat: number;
  lng: number;
  title: string;
  detail?: string;
}

export interface MapPoint {
  lat: number;
  lng: number;
}

/** สีเส้นทางไรเดอร์: คนที่ 1 แดง, คนที่ 2 เขียว, คนที่ 3 น้ำเงิน ตามที่เจ้าของร้านกำหนด (สีที่เหลือเลือกให้แยกจากกันชัดเจน) */
export const ROUTE_COLORS = ['#dc2626', '#16a34a', '#2563eb', '#9333ea', '#ea580c', '#db2777', '#92400e', '#475569', '#0891b2', '#ca8a04', '#84cc16', '#4f46e5'];
export const ROUTE_COLOR_NAMES = ['แดง', 'เขียว', 'น้ำเงิน', 'ม่วง', 'ส้ม', 'ชมพู', 'น้ำตาล', 'เทาเข้ม', 'ฟ้า', 'เหลืองทอง', 'เขียวมะนาว', 'คราม'];

/**
 * สีของไรเดอร์คนที่ index: ใช้สีในชุดก่อน เมื่อไรเดอร์เกินจำนวนสีจะสร้างสีใหม่ให้ไม่ซ้ำ
 * (หมุนเฉดสีทีละ 137.5° และสลับความสว่าง) จึงไม่มีไรเดอร์สองคนได้สีเดียวกัน
 */
export const routeColor = (index: number) => {
  const i = Math.max(0, Math.floor(index));
  if (i < ROUTE_COLORS.length) return ROUTE_COLORS[i];
  const k = i - ROUTE_COLORS.length;
  return `hsl(${Math.round((k * 137.5 + 20) % 360)} 70% ${k % 2 ? 62 : 38}%)`;
};
export const routeColorName = (index: number) => {
  const i = Math.max(0, Math.floor(index));
  return i < ROUTE_COLOR_NAMES.length ? ROUTE_COLOR_NAMES[i] : `สีที่ ${i + 1}`;
};
/** เลือกสีจาก rider_id เพื่อให้ไรเดอร์คนเดิมได้สีเดิมทุกหน้า (id เริ่มที่ 1 -> แดง) */
export const riderColorIndex = (riderId: number) => Math.max(0, riderId - 1);

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
 * - ใส่ [pickable]="true" เพื่อให้คลิกบนแผนที่เลือกตำแหน่งได้ (รับค่าผ่าน (pick), แสดงหมุดที่เลือกด้วย [picked], ลากหมุดปรับตำแหน่งได้)
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
  /** แสดงเลขออเดอร์ (#123) บนหมุดข้างเลขลำดับ */
  showOrderNo = input(false);
  /** โหมดเลือกตำแหน่ง: คลิกแผนที่หรือลากหมุดเพื่อเลือกพิกัด */
  pickable = input(false);
  picked = input<MapPoint | null>(null);
  pick = output<MapPoint>();

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  protected ready = signal(false);
  protected roads = signal<Record<number, { km: number; min: number }>>({});
  protected roadState = signal<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  private drawToken = 0;
  /** เส้นของไรเดอร์แต่ละคน (เก็บแนวจริงไว้ เพื่อเลื่อนเป็นเลนขนานกันเมื่อใช้ถนนเดียวกัน) */
  private lanes: { line: Leaflet.Polyline; base: Leaflet.LatLngTuple[]; lane: number }[] = [];
  private laneCount = 1;

  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layer?: Leaflet.LayerGroup;
  private pickLayer?: Leaflet.LayerGroup;
  private hadPick = false;

  protected legend = computed(() =>
    this.routes().map((r, i) => ({
      name: r.name,
      color: routeColor(r.colorIndex ?? i),
      colorName: routeColorName(r.colorIndex ?? i),
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
      this.pickLayer = this.L.layerGroup().addTo(this.map);
      this.map.on('zoomend', () => this.relayout());
      this.map.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (this.pickable()) this.pick.emit(this.round(e.latlng.lat, e.latlng.lng));
      });
      if (this.pickable()) this.host().nativeElement.style.cursor = 'crosshair';
      // แผนที่ที่เปิดในกล่องโต้ตอบ (modal) ต้องคำนวณขนาดใหม่หลังกล่องแสดงเสร็จ
      setTimeout(() => this.map?.invalidateSize(), 250);
      this.ready.set(true);
    });

    // วาดหมุดที่เลือก (โหมด pickable)
    effect(() => {
      const p = this.picked();
      const ready = this.ready();
      if (!ready || !this.L || !this.map || !this.pickLayer) return;
      this.drawPick(p);
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

  private round(lat: number, lng: number): MapPoint {
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  }

  private drawPick(p: MapPoint | null) {
    const L = this.L!;
    const map = this.map!;
    this.pickLayer!.clearLayers();
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
      this.hadPick = false;
      return;
    }
    const marker = L.marker([p.lat, p.lng], {
      draggable: this.pickable(),
      icon: L.divIcon({
        className: '',
        iconSize: [26, 34],
        iconAnchor: [13, 34],
        html: `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 1C6.4 1 1 6.2 1 12.7 1 21.5 13 33 13 33s12-11.5 12-20.3C25 6.2 19.6 1 13 1z" fill="#dc2626" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>`,
      }),
    }).addTo(this.pickLayer!);
    marker.on('dragend', () => {
      const ll = marker.getLatLng();
      this.pick.emit(this.round(ll.lat, ll.lng));
    });
    // เลือกครั้งแรก (หรือพิมพ์พิกัดเอง) ให้แผนที่เลื่อนมาที่หมุด
    if (!this.hadPick) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
    else if (!map.getBounds().contains([p.lat, p.lng])) map.panTo([p.lat, p.lng]);
    this.hadPick = true;
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
      const color = routeColor(r.colorIndex ?? i);
      const withNo = this.showOrderNo();
      const pts: Leaflet.LatLngTuple[] = [
        ...(shop ? [[shop.lat, shop.lng] as Leaflet.LatLngTuple] : []),
        ...r.stops.map(s => [s.lat, s.lng] as Leaflet.LatLngTuple),
      ];
      // เส้นประ = ระยะตรงชั่วคราว จะถูกแทนด้วยเส้นตามถนนจริงเมื่อโหลดเสร็จ
      const line = L.polyline(pts, { color, weight: 4, opacity: 0.95, lineJoin: 'round', dashArray: pts.length > 1 ? '4 8' : undefined }).addTo(this.layer!);
      if (pts.length > 1) jobs.push({ line, pts, i });
      for (const s of r.stops) {
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: '',
            iconSize: withNo && s.orderId ? [0, 0] : [28, 28],
            iconAnchor: [14, 14],
            html:
              withNo && s.orderId
                ? `<div style="display:flex;align-items:center;gap:4px;width:max-content;height:28px;padding:0 9px 0 0;border-radius:9999px;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);font:700 12px 'Noto Sans Thai',sans-serif"><span style="width:22px;text-align:center;font-size:13px">${s.seq}</span><span>#${s.orderId}</span></div>`
                : `<div style="width:28px;height:28px;border-radius:9999px;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:grid;place-items:center;font:700 13px 'Noto Sans Thai',sans-serif">${s.seq}</div>`,
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

    this.lanes = jobs.map(j => ({ line: j.line, base: j.pts, lane: j.i }));
    this.laneCount = Math.max(1, routes.length);
    this.relayout();

    if (jobs.length) void this.loadRoads(jobs, token);
    else this.roadState.set('idle');
  }

  /**
   * เลื่อนเส้นของไรเดอร์แต่ละคนไปด้านข้างเล็กน้อย (หน่วยพิกเซล) ให้เป็นเลนขนานกัน
   * เส้นที่ใช้ถนนร่วมกันจึงไม่ทับกัน เห็นครบทุกสี คำนวณใหม่ทุกครั้งที่ซูม
   */
  private relayout() {
    const map = this.map;
    if (!map) return;
    const n = this.laneCount;
    const spacing = n > 1 ? Math.min(5, 26 / (n - 1)) : 0;
    for (const l of this.lanes) {
      const off = (l.lane - (n - 1) / 2) * spacing;
      if (!off || l.base.length < 2) {
        l.line.setLatLngs(l.base);
        continue;
      }
      const pts = l.base.map(ll => map.latLngToLayerPoint(ll));
      const shifted = pts.map((p, k) => {
        const a = pts[Math.max(0, k - 1)];
        const b = pts[Math.min(pts.length - 1, k + 1)];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        // เวกเตอร์ตั้งฉากกับทิศทางเดินทาง
        return map.layerPointToLatLng([p.x + (-dy / len) * off, p.y + (dx / len) * off] as Leaflet.PointExpression);
      });
      l.line.setLatLngs(shifted);
    }
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
      const lane = this.lanes.find(l => l.line === j.line);
      if (lane) lane.base = road.coords;
      j.line.setStyle({ dashArray: undefined });
      this.relayout();
      this.roads.update(r => ({ ...r, [j.i]: { km: road.km, min: road.min } }));
    }
    this.roadState.set(failed ? 'fail' : 'ok');
  }
}