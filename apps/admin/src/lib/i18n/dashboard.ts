export type Locale = 'en' | 'bn';

export const dashboardDictionary = {
  en: {
    storeOverview: 'Store Overview',
    dashboard: 'Dashboard',
    liveData: 'Live store data',
    refresh: 'Refresh',
    refreshing: 'Refreshing...',
    refreshedAt: 'Refreshed',
    lastUpdated: 'Last updated',
    vsPreviousPeriod: 'vs previous period',
    searchPlaceholder: 'Search orders, products, customers (Ctrl+K)...',
    notifications: 'Notifications',
    markAllRead: 'Mark all as read',
    noNotifications: 'No alerts right now',

    // Ranges
    today: 'Today',
    last7Days: 'Last 7 Days',
    last30Days: 'Last 30 Days',
    last90Days: 'Last 90 Days',
    thisMonth: 'This Month',
    customRange: 'Custom Range',

    // KPI Cards
    totalSales: 'Total sales',
    totalOrders: 'Total orders',
    customers: 'Customers',
    inventoryItems: 'Inventory items',
    avgOrderValue: 'Avg Order Value',
    refundRate: 'Refund Rate',
    conversionRate: 'Conversion Rate',

    salesNote: 'Net sales after refunds (BDT)',
    ordersNote: 'Orders placed in period',
    customersNote: 'New customer accounts',
    inventoryNote: 'Total on-hand units in catalog',
    aovNote: 'Average value per order',
    refundNote: 'Percentage of revenue refunded',
    conversionNote: 'Visitors converting to purchase',

    lowStockBadge: 'Low Stock',
    outOfStockBadge: 'Out of Stock',

    // Widgets
    revenueAnalytics: 'Revenue analytics',
    revenue: 'Revenue',
    orders: 'Orders',
    aov: 'AOV',
    exportCsv: 'Export CSV',
    exportPng: 'Export PNG',

    monthlyTarget: 'Monthly target',
    targetProgress: 'Target progress',
    remaining: 'Remaining',
    daysLeft: 'days left',
    needsPerDay: 'needed / day',
    editTarget: 'Edit target',
    saveTarget: 'Save target',
    targetAmountPlaceholder: 'Monthly sales target in BDT',

    topCategories: 'Top categories',
    categoryShare: 'share of top category sales',

    topProducts: 'Top selling products',
    unitsSold: 'units sold',

    recentOrders: 'Recent orders',
    orderNumber: 'Order #',
    customer: 'Customer',
    status: 'Status',
    payment: 'Payment',
    amount: 'Amount',
    time: 'Time',
    quickView: 'View details',

    customerActivity: 'Customer activity',
    activeCustomers: 'Active customers',
    activeCustomersNote: 'Customers with orders in the last 30 days',
    newCustomers: 'New customers',
    returningCustomers: 'Returning customers',
    repeatPurchaseRate: 'Repeat purchase rate',

    conversionFunnel: 'Conversion funnel',
    productViews: 'Product views',
    addedToCart: 'Added to cart',
    checkout: 'Checkout started',
    purchases: 'Purchases',
    dropOff: 'drop-off',

    trafficSources: 'Traffic sources',
    trackedSessions: 'tracked sessions in period',

    lowStockAlerts: 'Low stock alerts',
    restock: 'Restock',

    paymentMethods: 'Payment methods',
    ordersByDistrict: 'Orders by district / city',
    activityFeed: 'Store activity feed',

    // Customization & Empty States
    customizeWidgets: 'Customize layout',
    resetLayout: 'Reset layout',
    hideWidget: 'Hide',
    showWidget: 'Show',
    noDataTitle: 'No activity recorded yet',
    noDataDescription: 'Metrics will update dynamically as soon as events are recorded.',
    setTargetCta: 'Set monthly target',
    viewCatalogCta: 'View catalog',
    manageOrdersCta: 'View orders',
  },
  bn: {
    storeOverview: 'স্টোর পরিচিতি',
    dashboard: 'ড্যাশবোর্ড',
    liveData: 'লাইভ স্টোর তথ্য',
    refresh: 'রিফ্রেশ',
    refreshing: 'রিফ্রেশ হচ্ছে...',
    refreshedAt: 'হালনাগাদ',
    lastUpdated: 'সর্বশেষ আপডেট',
    vsPreviousPeriod: 'পূর্ববর্তী সময়ের তুলনায়',
    searchPlaceholder: 'অর্ডার, পণ্য ও গ্রাহক খুঁজুন (Ctrl+K)...',
    notifications: 'নোটিফিকেশন',
    markAllRead: 'সবগুলো পঠিত চিহ্নিত করুন',
    noNotifications: 'এখন কোনো নোটিফিকেশন নেই',

    // Ranges
    today: 'আজ',
    last7Days: 'গত ৭ দিন',
    last30Days: 'গত ৩০ দিন',
    last90Days: 'গত ৯০ দিন',
    thisMonth: 'এই মাস',
    customRange: 'কাস্টম রেঞ্জ',

    // KPI Cards
    totalSales: 'মোট বিক্রি',
    totalOrders: 'মোট অর্ডার',
    customers: 'গ্রাহক সংখ্যা',
    inventoryItems: 'মজুদ পণ্য',
    avgOrderValue: 'গড় অর্ডার মূল্য',
    refundRate: 'রিফান্ড হার',
    conversionRate: 'কনভার্সন হার',

    salesNote: 'রিফান্ড বাদে নেট বিক্রি (টাকা)',
    ordersNote: 'নির্বাচিত সময়ে গৃহীত অর্ডার',
    customersNote: 'নতুন গ্রাহক অ্যাকাউন্ট',
    inventoryNote: 'ক্যাটালগে মোট উপস্থিত ইউনিট',
    aovNote: 'প্রতি অর্ডারের গড় মূল্য',
    refundNote: 'মোট বিক্রির রিফান্ড শতকরা',
    conversionNote: 'ক্রয় সম্পন্নকারী ভিজিটর',

    lowStockBadge: 'স্বল্প স্টক',
    outOfStockBadge: 'স্টক শেষ',

    // Widgets
    revenueAnalytics: 'রাজস্ব বিশ্লেষণ',
    revenue: 'বিক্রি',
    orders: 'অর্ডার',
    aov: 'গড় মূল্য',
    exportCsv: 'CSV ডাউনলোড',
    exportPng: 'PNG ডাউনলোড',

    monthlyTarget: 'মাসিক লক্ষ্যমাত্রা',
    targetProgress: 'লক্ষ্যমাত্রা অর্জনের হার',
    remaining: 'অবশিষ্ট',
    daysLeft: 'দিন বাকি',
    needsPerDay: 'প্রতিদিন প্রয়োজন',
    editTarget: 'টার্গেট পরিবর্তন',
    saveTarget: 'সংরক্ষণ করুন',
    targetAmountPlaceholder: 'টাকায় মাসিক টার্গেট লিখুন',

    topCategories: 'শীর্ষ ক্যাটাগরি',
    categoryShare: 'শীর্ষ ক্যাটাগরির বিক্রির অংশ',

    topProducts: 'সর্বোচ্চ বিক্রিত পণ্য',
    unitsSold: 'ইউনিট বিক্রিত',

    recentOrders: 'সাম্প্রতিক অর্ডারসমূহ',
    orderNumber: 'অর্ডার নং',
    customer: 'গ্রাহক',
    status: 'অবস্থা',
    payment: 'পেমেন্ট',
    amount: 'পরিমাণ',
    time: 'সময়',
    quickView: 'বিস্তারিত দেখুন',

    customerActivity: 'গ্রাহক কার্যকলাপ',
    activeCustomers: 'সক্রিয় গ্রাহক',
    activeCustomersNote: 'গত ৩০ দিনে অর্ডারকারী গ্রাহক',
    newCustomers: 'নতুন গ্রাহক',
    returningCustomers: 'পুনরাবৃত্ত গ্রাহক',
    repeatPurchaseRate: 'পুনঃক্রয় হার',

    conversionFunnel: 'কনভার্সন ফানেল',
    productViews: 'পণ্য প্রদর্শন',
    addedToCart: 'কার্টে যুক্ত',
    checkout: 'চেকআউট শুরু',
    purchases: 'ক্রয় সম্পন্ন',
    dropOff: 'ড্রপ-অফ',

    trafficSources: 'ট্রাফিক উৎস',
    trackedSessions: 'ট্র্যাককৃত ভিজিটর সেশন',

    lowStockAlerts: 'স্বল্প স্টক সতর্কতা',
    restock: 'স্টক বাড়ান',

    paymentMethods: 'পেমেন্ট মাধ্যমসমূহ',
    ordersByDistrict: 'জেলা ও শহর অনুযায়ী অর্ডার',
    activityFeed: 'সাম্প্রতিক কার্যকলাপ',

    // Customization & Empty States
    customizeWidgets: 'লেআউট সাজান',
    resetLayout: 'রিসেট লেআউট',
    hideWidget: 'লুকান',
    showWidget: 'দেখান',
    noDataTitle: 'এখনও কোনো তথ্য নেই',
    noDataDescription: 'নতুন কার্যকলাপ ঘটার সাথে সাথে ড্যাশবোর্ড আপডেট হবে।',
    setTargetCta: 'টার্গেট সেট করুন',
    viewCatalogCta: 'ক্যাটালগ দেখুন',
    manageOrdersCta: 'অর্ডার দেখুন',
  },
} as const;

export type DashboardDictionaryKey = keyof typeof dashboardDictionary['en'];
export type DashboardDictionary = Record<DashboardDictionaryKey, string>;

export function getDashboardDictionary(locale: Locale): DashboardDictionary {
  return dashboardDictionary[locale] ?? dashboardDictionary.en;
}
