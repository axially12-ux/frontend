import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** หน้าของเจ้าของร้าน: ถ้าเซิร์ฟเวอร์ตั้งรหัสผ่านไว้และยังไม่ได้ล็อกอิน ให้ไปหน้าล็อกอินก่อน */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.checkRequired().pipe(
    map(required => (!required || auth.isLoggedIn() ? true : router.createUrlTree(['/login'], { queryParams: { next: state.url } }))),
    // เซิร์ฟเวอร์ติดต่อไม่ได้ (เช่น เซิร์ฟเวอร์ฟรีกำลังตื่น) ปล่อยเข้าไปก่อน หน้าจะแจ้ง error เอง
    catchError(() => of(true)),
  );
};
