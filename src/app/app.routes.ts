import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'ภาพรวม · Rider', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'customers', title: 'ลูกค้า · Rider', loadComponent: () => import('./pages/customers/customers').then(m => m.Customers) },
  { path: 'orders', title: 'ออเดอร์ · Rider', loadComponent: () => import('./pages/orders/orders').then(m => m.Orders) },
  { path: 'planner', title: 'จัดเส้นทาง · Rider', loadComponent: () => import('./pages/planner/planner').then(m => m.Planner) },
  { path: 'routes', title: 'เส้นทางที่บันทึก · Rider', loadComponent: () => import('./pages/routes/routes').then(m => m.RoutesPage) },
  { path: 'routes/:id', title: 'รายละเอียดเส้นทาง · Rider', loadComponent: () => import('./pages/route-detail/route-detail').then(m => m.RouteDetailPage) },
  { path: 'shop', title: 'ตั้งค่าร้าน · Rider', loadComponent: () => import('./pages/shop/shop').then(m => m.ShopPage) },
  { path: 'rider', title: 'สำหรับไรเดอร์ · Rider', loadComponent: () => import('./pages/rider/rider').then(m => m.RiderPage) },
  { path: '**', redirectTo: '' },
];
