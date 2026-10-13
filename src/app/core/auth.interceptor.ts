import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE } from './api.config';
import { AuthService } from './auth.service';

/** แนบ token เจ้าของร้านไปกับทุกคำขอไป API และพาไปหน้าล็อกอินเมื่อ token หมดอายุ (401) */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!req.url.startsWith(API_BASE)) return next(req);

  const token = auth.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError(e => {
      // 401 จากหน้าล็อกอินเอง (รหัสผิด) ไม่ต้องเด้ง
      if (e instanceof HttpErrorResponse && e.status === 401 && !req.url.includes('/auth/login')) {
        auth.clear();
        if (!router.url.startsWith('/login') && !router.url.startsWith('/rider')) {
          router.navigate(['/login'], { queryParams: { next: router.url } });
        }
      }
      return throwError(() => e);
    }),
  );
};
