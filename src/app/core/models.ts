export type OrderStatus = 'pending' | 'assigned' | 'delivered';

export interface Customer {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  lat: number | string;
  lng: number | string;
  distance_km?: number;
}

export type CustomerInput = Omit<Customer, 'id' | 'distance_km'>;

export interface Order {
  id: number;
  customer_id: number;
  boxes: number;
  status: OrderStatus;
  created_at: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  lat: number | string;
  lng: number | string;
  distance_km?: number;
}

/** จุดส่งที่ได้จากการคำนวณ (POST /routes/calculate) */
export interface PlanStop {
  seq: number;
  order_id: number;
  customer_id: number;
  customer_name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  boxes: number;
  leg_km: number;
  arrive_minutes?: number;
  arrive_time?: string;
}

export interface PlanRoute {
  rider_id: number;
  rider_name: string;
  rider_phone?: string;
  access_code?: string;
  on_time?: boolean;
  is_new?: boolean;
  orders_count: number;
  total_boxes: number;
  total_km: number;
  estimated_minutes: number;
  estimated_arrival: string;
  rider_cost: number;
  revenue: number;
  food_cost: number;
  profit_before_other_expenses: number;
  stops: PlanStop[];
}

export interface PlanSummary {
  orders?: number;
  orders_assigned?: number;
  orders_unassigned?: number;
  riders_used?: number;
  total_km: number;
  total_rider_cost: number;
  revenue: number;
  food_cost: number;
  profit_before_other_expenses: number;
  within_one_hour?: boolean;
  latest_arrival_minutes?: number;
}

export interface PlanResult {
  message?: string;
  method?: string;
  shop?: { id: number; name: string; lat: number | string; lng: number | string };
  settings?: {
    max_orders_per_rider: number;
    estimated_speed_kmh: number;
    service_minutes_per_stop: number;
    delivery_window: string;
  };
  variant?: number;
  tries?: number;
  routes: PlanRoute[];
  unassigned: { order_id: number; reason: string }[];
  summary: PlanSummary;
}

/** เส้นทางที่บันทึกแล้ว (GET /routes) */
export interface SavedRoute {
  route_id: number;
  rider_id: number;
  rider_name: string;
  total_km: number | string;
  total_cost: number | string;
  created_at: string;
  orders_count: number;
  order_ids: string | null;
  rider_access_code?: string;
}

export interface RouteStop {
  seq: number;
  order_id: number;
  boxes: number;
  status: OrderStatus;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  lat: number | string;
  lng: number | string;
}

export interface RouteDetail {
  id: number;
  rider_id: number;
  rider_name: string;
  rider_phone: string;
  total_km: number | string;
  total_cost: number | string;
  created_at: string;
  stops: RouteStop[];
}

export interface RiderJob {
  rider: { id: number; name: string; phone: string };
  route: { route_id: number; total_km: number | string; total_cost: number | string; created_at: string } | null;
  stops?: RouteStop[];
  message?: string;
}
