import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { errorText } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="mx-auto mt-10 max-w-sm sm:mt-20">
      <div class="mb-6 text-center">
        <p class="text-3xl font-bold"><span class="text-brand-500">●</span> Rider</p>
        <p class="mt-1 text-sm text-slate-500">เข้าสู่ระบบสำหรับเจ้าของร้าน</p>
      </div>
      <form class="card space-y-3 p-5" (ngSubmit)="submit()">
        <div>
          <label class="label" for="pw">รหัสผ่าน</label>
          <input id="pw" class="field" type="password" name="password" [(ngModel)]="password" autocomplete="current-password" autofocus />
        </div>
        @if (error()) {
          <p class="rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{{ error() }}</p>
        }
        <button class="btn btn-primary w-full !py-2.5" type="submit" [disabled]="busy() || !password">{{ busy() ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ' }}</button>
      </form>
      <p class="mt-4 text-center text-sm text-slate-500">เป็นไรเดอร์? <a class="font-medium text-brand-600 hover:underline" href="/rider">ไปหน้าไรเดอร์</a></p>
    </div>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  password = '';
  busy = signal(false);
  error = signal('');

  constructor() {
    // ไม่ต้องล็อกอิน (เซิร์ฟเวอร์ไม่ได้ตั้งรหัสผ่าน) หรือล็อกอินอยู่แล้ว -> เข้าหน้าหลักเลย
    this.auth.checkRequired().subscribe({
      next: required => {
        if (!required || this.auth.isLoggedIn()) this.done();
      },
      error: () => undefined,
    });
  }

  submit() {
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.password).subscribe({
      next: () => this.done(),
      error: e => {
        this.error.set(errorText(e));
        this.busy.set(false);
      },
    });
  }

  private done() {
    const next = this.route.snapshot.queryParamMap.get('next');
    // กัน open redirect: อนุญาตเฉพาะพาธภายในเว็บ
    this.router.navigateByUrl(next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/');
  }
}
