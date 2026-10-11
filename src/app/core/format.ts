export const num = (v: unknown): number => Number(v) || 0;

export const baht = (v: unknown): string =>
  '฿' + num(v).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const km = (v: unknown): string => num(v).toFixed(2) + ' กม.';

export function fmtDate(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const fullName = (o: { first_name: string; last_name: string }) => `${o.first_name} ${o.last_name}`;

/** ลิงก์เปิด Google Maps ที่พิกัด */
export const mapsUrl = (lat: unknown, lng: unknown) =>
  `https://www.google.com/maps/search/?api=1&query=${num(lat)},${num(lng)}`;
