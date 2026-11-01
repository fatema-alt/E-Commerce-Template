export type TimeRange = "today" | "7d" | "30d" | "90d" | "this_month" | "custom";
export type CompareMode = "prev_period" | "none";

export interface TotalsBreakdown {
  pending: number;
  confirmed?: number;
  processing: number;
  shipped?: number;
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
  inventory?: number;
  aov: string | null;
  refundRate: number | null;
  conversionRate: number | null;
  deltas?: Record<string, number | null>;
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
  conversionRate?: number[];
}

export interface RevenueSeriesPoint {
  date?: string;
  day?: string;
  label?: string;
  revenue: number | string;
  orders: number;
  aov: number | string;
}

export interface MonthlyTargetData {
  month: string;
  target?: number;
  amount?: string | number;
  actual?: number;
  achieved?: string | number;
  remaining?: string | number;
  daysLeft?: number;
  runRateNeeded?: string | number;
  progressPercentage?: number;
  progress?: number;
  projectedEndMonth?: number;
  status?: "on_track" | "at_risk" | "achieved";
}

export interface TopCategoryItem {
  id?: string;
  name: string;
  revenue?: number | string;
  amount?: string | number;
  orders?: number;
  percentage?: number;
  share?: number;
}

export interface TopProductItem {
  id: string;
  name: string;
  sku?: string;
  slug?: string;
  image: string | null;
  units?: number;
  unitsSold?: number;
  revenue: number | string;
}

export interface RecentOrderItem {
  id: string;
  orderNumber: string;
  status: string;
  total?: number | string;
  grandTotal?: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  customerName: string;
  customerEmail?: string;
  itemsCount: number;
  createdAt: string;
}

export interface CustomerActivityData {
  active?: number;
  active30d?: number;
  new?: number;
  newInPeriod?: number;
  returning?: number;
  returningCustomers?: number;
  repeatRate?: number | null;
  repeatPurchaseRate?: number | null;
}

export interface ConversionFunnelData {
  productViews: number;
  addedToCart?: number;
  addToCart?: number;
  checkout?: number;
  checkoutStart?: number;
  purchases: number;
  dropOffRates?: {
    viewToCart?: number | null;
    cartToCheckout?: number | null;
    checkoutToPurchase?: number | null;
  };
  dropoffViewsToCart?: number | null;
  dropoffCartToCheckout?: number | null;
  dropoffCheckoutToPurchase?: number | null;
}

export interface TrafficSourceItem {
  source: string;
  sessions?: number;
  count?: number;
  percentage?: number;
  share?: number;
}

export interface LowStockAlertItem {
  id: string;
  name: string;
  sku: string;
  stock?: number;
  quantity?: number;
  reorderPoint?: number;
  lowStockAt?: number;
  threshold?: number;
  isOutOfStock?: boolean;
}

export interface PaymentMethodItem {
  method?: string;
  provider?: string;
  count: number;
  amount?: string | null;
  share?: number;
  percentage?: number;
}

export interface GeoDistrictItem {
  district: string;
  orders: number;
  revenue: number | string | null;
}

export interface ActivityFeedItem {
  id: string;
  type: "order" | "review" | "stock" | string;
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
  previousTotals?: DashboardPreviousTotals | null;
  comparison?: DashboardPreviousTotals | null;
  changes?: DashboardChanges | null;
  sparklines: SparklinesData;
  revenueSeries?: RevenueSeriesPoint[];
  revenue?: RevenueSeriesPoint[];
  monthlyTarget?: MonthlyTargetData;
  target?: MonthlyTargetData;
  topCategories?: TopCategoryItem[];
  categories?: TopCategoryItem[];
  topProducts: TopProductItem[];
  recentOrders: RecentOrderItem[];
  customerActivity?: CustomerActivityData;
  customers?: CustomerActivityData;
  funnel: ConversionFunnelData;
  trafficSources?: TrafficSourceItem[];
  sources?: TrafficSourceItem[];
  lowStockAlerts?: LowStockAlertItem[];
  lowStock?: LowStockAlertItem[];
  paymentMethods: PaymentMethodItem[];
  geoDistricts: GeoDistrictItem[];
  activityFeed: ActivityFeedItem[];
  notifications:
    | DashboardNotification[]
    | {
        unreadCount: number;
        items: DashboardNotification[];
      };
}
