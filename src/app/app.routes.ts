import { Routes } from '@angular/router';
import { adminGuard } from './core/auth.guard';

// หน้าของเจ้าของร้านทั้งหมดอยู่หลัง adminGuard (ล็อกอิน) ส่วนหน้าไรเดอร์ (/rider) เปิดให้ใช้ด้วยเลขใบงานเท่านั้น
const admin = { canActivate: [adminGuard] };

export const routes: Routes = [
  { path: 'login', title: 'เข้าสู่ระบบ · Rider', loadComponent: () => import('./pages/login/login').then(m => m.LoginPage) },
  { path: '', pathMatch: 'full', title: 'ภาพรวม · Rider', ...admin, loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'customers', title: 'ลูกค้า · Rider', ...admin, loadComponent: () => import('./pages/customers/customers').then(m => m.Customers) },
  { path: 'orders', title: 'ออเดอร์ · Rider', ...admin, loadComponent: () => import('./pages/orders/orders').then(m => m.Orders) },
  { path: 'planner', title: 'จัดเส้นทาง · Rider', ...admin, loadComponent: () => import('./pages/planner/planner').then(m => m.Planner) },
  { path: 'routes', title: 'เส้นทางที่บันทึก · Rider', ...admin, loadComponent: () => import('./pages/routes/routes').then(m => m.RoutesPage) },
  { path: 'routes/:id', title: 'รายละเอียดเส้นทาง · Rider', ...admin, loadComponent: () => import('./pages/route-detail/route-detail').then(m => m.RouteDetailPage) },
  { path: 'shop', title: 'ตั้งค่าร้าน · Rider', ...admin, loadComponent: () => import('./pages/shop/shop').then(m => m.ShopPage) },
  { path: 'rider', title: 'สำหรับไรเดอร์ · Rider', loadComponent: () => import('./pages/rider/rider').then(m => m.RiderPage) },
  { path: '**', redirectTo: '' },
];
