import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';
import {
  Customer,
  CustomerInput,
  Order,
  OrderStatus,
  PlanResult,
  RiderJob,
  RouteDetail,
  SavedRoute,
  Shop,
} from './models';

/** แปลง error จาก API เป็นข้อความภาษาไทยที่อ่านง่าย */
export function errorText(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (เซิร์ฟเวอร์ฟรีอาจกำลังตื่น ลองใหม่อีกครั้ง)';
    const body = e.error;
    if (body && typeof body === 'object' && 'error' in body) return String(body.error);
    return `เกิดข้อผิดพลาด (${e.status})`;
  }
  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private url = (path: string) => `${API_BASE}${path}`;

  /* ---------- system ---------- */
  health(): Observable<{ status: string; database: string }> {
    return this.http.get<{ status: string; database: string }>(this.url('/health'));
  }

  /* ---------- customers ---------- */
  customers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.url('/customer'));
  }
  searchCustomers(name: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.url('/customer/search/fields'), { params: { name } });
  }
  nearbyCustomers(lat: number, lng: number): Observable<Customer[]> {
    return this.http.get<Customer[]>(this.url('/customer/nearby'), { params: { lat, lng } });
  }
  createCustomer(c: CustomerInput) {
    return this.http.post<{ affected_row: number; last_id: number }>(this.url('/customer'), c);
  }
  updateCustomer(id: number, c: Partial<CustomerInput>) {
    return this.http.put<{ affected_row: number; id: number }>(this.url(`/customer/${id}`), c);
  }
  deleteCustomer(id: number) {
    return this.http.delete(this.url(`/customer/${id}`));
  }

  /* ---------- orders ---------- */
  orders(): Observable<Order[]> {
    return this.http.get<Order[]>(this.url('/order'));
  }
  nearbyOrders(lat: number, lng: number): Observable<Order[]> {
    return this.http.get<Order[]>(this.url('/order/nearby'), { params: { lat, lng } });
  }
  createOrder(customer_id: number, boxes: number) {
    return this.http.post<{ affected_row: number; last_id: number }>(this.url('/order'), { customer_id, boxes });
  }
  simulateOrders() {
    return this.http.post<{ affected_row: number }>(this.url('/order/simulate'), {});
  }
  updateOrder(id: number, body: { boxes?: number; status?: OrderStatus }) {
    return this.http.put(this.url(`/order/${id}`), body);
  }
  deleteOrder(id: number) {
    return this.http.delete(this.url(`/order/${id}`));
  }
  clearOrders() {
    return this.http.delete(this.url('/order'));
  }

  /* ---------- shop ---------- */
  shop(): Observable<Shop | null> {
    return this.http.get<Shop | null>(this.url('/shop'));
  }
  saveShop(s: { name: string; lat: number; lng: number }) {
    return this.http.put<{ message: string }>(this.url('/shop'), s);
  }

  /* ---------- routes ---------- */
  /** variant = หมายเลขแผน (เปลี่ยนเลขเพื่อได้แผนอื่น), tries = ลองกี่แผนแล้วเลือกต้นทุนต่ำสุด */
  calculate(variant = 0, tries = 1): Observable<PlanResult> {
    return this.http.post<PlanResult>(this.url('/routes/calculate'), { variant, tries });
  }
  /** force = บันทึกทั้งที่มีไรเดอร์ถึงเกิน 12:30 (ต้องยืนยันกับผู้ใช้ก่อน) */
  saveRoutes(assignments: { rider_id: number; order_ids: number[] }[], force = false) {
    return this.http.post<{ message: string; routes: unknown[] }>(this.url('/routes/recalculate'), { assignments, force });
  }
  savedRoutes(): Observable<SavedRoute[]> {
    return this.http.get<SavedRoute[]>(this.url('/routes'));
  }
  route(id: number): Observable<RouteDetail> {
    return this.http.get<RouteDetail>(this.url(`/routes/${id}`));
  }
  riderJob(code: string): Observable<RiderJob> {
    return this.http.get<RiderJob>(this.url(`/routes/rider-job/${encodeURIComponent(code)}`));
  }
  deleteRoute(id: number) {
    return this.http.delete(this.url(`/routes/${id}`));
  }
  clearRoutes() {
    return this.http.delete(this.url('/routes'));
  }
  markDelivered(orderId: number, code?: string) {
    return this.http.patch<{ delivered_at: string | null; on_time: boolean | null }>(this.url(`/routes/stops/${orderId}/delivered`), { code });
  }
}
