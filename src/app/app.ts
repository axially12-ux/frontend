import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
})
export class App {
  protected toast = inject(ToastService);
  protected menuOpen = signal(false);

  protected readonly nav = [
    { path: '/', label: 'ภาพรวม', icon: '▦', exact: true },
    { path: '/customers', label: 'ลูกค้า', icon: '☺', exact: false },
    { path: '/orders', label: 'ออเดอร์', icon: '☰', exact: false },
    { path: '/planner', label: 'จัดเส้นทาง', icon: '⛯', exact: false },
    { path: '/routes', label: 'เส้นทางที่บันทึก', icon: '↝', exact: false },
    { path: '/rider', label: 'สำหรับไรเดอร์', icon: '⚑', exact: false },
  ];
}
