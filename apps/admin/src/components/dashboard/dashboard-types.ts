export type TimeRange = "today" | "7d" | "30d" | "90d" | "this_month" | "custom";
export type CompareMode = "prev_period" | "none";

export interface TotalsBreakdown {
  pending: number;
  processing: number;
  delivered: number;
  cancelled: number;
}

export interface DashboardTotals {
  sales: string | null;
  orders: number;
  customers: number;
  inventory: number;
  lowStockCount: number;
  outOfStockCount: number;
  aov: string | null;
  refundRate: number | null;
  conversionRate: number | null;
  breakdown: TotalsBreakdown;
}

export interface DashboardPreviousTotals {
  sales: string | null;
  orders: number;
  customers: number;
  inventory: number;
  aov: string | null;
  refundRate: number | null;
  conversionRate: number | null;
}

export interface DashboardChanges {
  sales: number | null;
  orders: number | null;
  customers: number | null;
  inventory: number | null;
  aov: number | null;
  refundRate: number | null;
  conversionRate: number | null;
}

export interface SparklinesData {
  sales: number[];
  orders: number[];
  customers: number[];
  inventory: number[];
  aov: number[];
  refundRate: number[];
}

export interface RevenueSeriesPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
  aov: number;
}

export interface MonthlyTargetData {
  month: string;
  target: number;
  actual: number;
  progressPercentage: number;
  projectedEndMonth: number;
  status: "on_track" | "at_risk" | "achieved";
}

export interface TopCategoryItem {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  percentage: number;
}

export interface TopProductItem {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  unitsSold: number;
  revenue: number;
}

export interface RecentOrderItem {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  customerEmail: string;
  itemsCount: number;
  createdAt: string;
}

export interface CustomerActivityData {
  active30d: number;
  newInPeriod: number;
  returningCustomers: number;
  repeatPurchaseRate: number | null;
}

export interface ConversionFunnelData {
  productViews: number;
  addToCart: number;
  checkoutStart: number;
  purchases: number;
  dropoffViewsToCart: number | null;
  dropoffCartToCheckout: number | null;
  dropoffCheckoutToPurchase: number | null;
}

export interface TrafficSourceItem {
  source: string;
  sessions: number;
  percentage: number;
}

export interface LowStockAlertItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  reorderPoint: number;
  threshold: number;
}

export interface PaymentMethodItem {
  provider: string;
  count: number;
  percentage: number;
}

export interface GeoDistrictItem {
  district: string;
  orders: number;
  revenue: number;
}

export interface ActivityFeedItem {
  id: string;
  type: "order" | "review" | "stock";
  title: string;
  description: string;
  timestamp: string;
}

export interface DashboardNotification {
  id: string;
  type: "order" | "low_stock" | "payment_failed" | "review";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export interface DashboardOverviewResponse {
  updatedAt: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  month: string;
  range: TimeRange;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
  totals: DashboardTotals;
  previousTotals: DashboardPreviousTotals | null;
  changes: DashboardChanges | null;
  sparklines: SparklinesData;
  revenueSeries: RevenueSeriesPoint[];
  monthlyTarget: MonthlyTargetData;
  topCategories: TopCategoryItem[];
  topProducts: TopProductItem[];
  recentOrders: RecentOrderItem[];
  customerActivity: CustomerActivityData;
  funnel: ConversionFunnelData;
  trafficSources: TrafficSourceItem[];
  lowStockAlerts: LowStockAlertItem[];
  paymentMethods: PaymentMethodItem[];
  geoDistricts: GeoDistrictItem[];
  activityFeed: ActivityFeedItem[];
  notifications: DashboardNotification[];
}
