import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected toast = inject(ToastService);
  private router = inject(Router);
  protected menuOpen = signal(false);

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** หน้าไรเดอร์ไม่แสดงเมนูของเจ้าของร้าน (ไรเดอร์ไม่ควรเห็นเมนูจัดการร้าน) */
  protected adminLayout = computed(() => {
    const u = this.url();
    return !u.startsWith('/rider');
  });

  protected readonly nav = [
    { path: '/', label: 'ภาพรวม', icon: '▦', exact: true },
    { path: '/customers', label: 'ลูกค้า', icon: '☺', exact: false },
    { path: '/orders', label: 'ออเดอร์', icon: '☰', exact: false },
    { path: '/planner', label: 'จัดเส้นทาง', icon: '⛯', exact: false },
    { path: '/routes', label: 'เส้นทางที่บันทึก', icon: '↝', exact: false },
    { path: '/shop', label: 'ตั้งค่าร้าน', icon: '⚙', exact: false },
    { path: '/rider', label: 'ดูหน้าไรเดอร์', icon: '⚑', exact: false },
  ];
}
