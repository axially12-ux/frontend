import { RenderMode, ServerRoute } from '@angular/ssr';

// หน้าทั้งหมดดึงข้อมูลจาก API ตอนใช้งาน จึงเรนเดอร์ฝั่ง client
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
