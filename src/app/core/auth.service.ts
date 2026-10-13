import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, of, tap } from 'rxjs';
import { API_BASE } from './api.config';

const TOKEN_KEY = 'owner.token';
const EXP_KEY = 'owner.token_exp';

/** ล็อกอินเจ้าของร้าน (รหัสผ่านเดียว) ถ้าเซิร์ฟเวอร์ไม่ได้ตั้ง ADMIN_PASSWORD จะไม่ต้องล็อกอิน */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** null = ยังไม่รู้ว่าเซิร์ฟเวอร์ต้องการล็อกอินไหม */
  readonly required = signal<boolean | null>(null);
  readonly token = signal<string>(this.read(TOKEN_KEY));

  /** เซิร์ฟเวอร์ต้องล็อกอินไหม (ถามครั้งเดียวแล้วจำไว้) */
  checkRequired(): Observable<boolean> {
    const known = this.required();
    if (known !== null) return of(known);
    return this.http.get<{ required: boolean }>(`${API_BASE}/auth/status`).pipe(
      map(r => r.required),
      tap(r => this.required.set(r)),
    );
  }

  isLoggedIn(): boolean {
    const exp = Number(this.read(EXP_KEY));
    if (!this.token() || (exp && exp < Date.now())) {
      this.clear();
      return false;
    }
    return true;
  }

  login(password: string): Observable<void> {
    return this.http.post<{ token: string; expires_in: number }>(`${API_BASE}/auth/login`, { password }).pipe(
      tap(r => {
        this.token.set(r.token);
        this.write(TOKEN_KEY, r.token);
        this.write(EXP_KEY, String(Date.now() + r.expires_in * 1000));
      }),
      map(() => undefined),
    );
  }

  logout() {
    this.clear();
  }

  clear() {
    this.token.set('');
    this.write(TOKEN_KEY, '');
    this.write(EXP_KEY, '');
  }

  private read(key: string): string {
    try {
      return this.browser ? (localStorage.getItem(key) ?? '') : '';
    } catch {
      return '';
    }
  }

  private write(key: string, value: string) {
    try {
      if (!this.browser) return;
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      /* ไม่เป็นไรถ้าบันทึกไม่ได้ */
    }
  }
}
