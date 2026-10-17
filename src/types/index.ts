export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (exclusivo, como el check-out)
}

export interface OccupancyPoint {
  hotel_id: string;
  date: string;
  available_nights: number;
  occupied_nights: number;
  occupancy: number; // 0–1
}

export interface KpiPoint {
  hotel_id: string;
  date: string;
  adr: number;
  revpar: number;
  rooms_sold: number;
  revenue: number;
}

export interface ForecastPoint {
  hotel_id: string;
  date: string;
  occupancy_expected: number;
  adr_expected: number;
  revpar_expected: number;
}

export interface Dashboard {
  hotel_id: string;
  range: DateRange;
  occupancy_avg: number;
  adr_avg: number;
  revpar_avg: number;
  forecast: ForecastPoint[];
}
