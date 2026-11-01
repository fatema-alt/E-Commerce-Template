import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient, AdminRole, OrderPaymentMethod, OrderStatus, OrderPaymentStatus } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/auth/password.js';
import { cleanDashboardDemo } from './clean-dashboard-demo.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run demo seed script in production!');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const BANGLADESH_DISTRICTS = [
  'Dhaka',
  'Chittagong',
  'Sylhet',
  'Rajshahi',
  'Khulna',
  'Barisal',
  'Rangpur',
  'Mymensingh',
  'Comilla',
  'Gazipur',
  'Narayanganj',
  'Bogra',
];

const CUSTOMER_NAMES = [
  { first: 'Anisur', last: 'Rahman', phone: '01711000001' },
  { first: 'Tahmina', last: 'Akter', phone: '01812000002' },
  { first: 'Shafiqul', last: 'Islam', phone: '01913000003' },
  { first: 'Nusrat', last: 'Jahan', phone: '01614000004' },
  { first: 'Tanvir', last: 'Hasan', phone: '01715000005' },
  { first: 'Farhana', last: 'Chowdhury', phone: '01816000006' },
  { first: 'Kamrul', last: 'Huda', phone: '01917000007' },
  { first: 'Sumaiya', last: 'Sultana', phone: '01618000008' },
  { first: 'Mahmudul', last: 'Hasan', phone: '01719000009' },
  { first: 'Roksana', last: 'Parvin', phone: '01820000010' },
  { first: 'Zubair', last: 'Ahmed', phone: '01921000011' },
  { first: 'Fatima', last: 'Zohra', phone: '01622000012' },
  { first: 'Arifur', last: 'Rahman', phone: '01723000013' },
  { first: 'Nasrin', last: 'Begum', phone: '01824000014' },
  { first: 'Mehedi', last: 'Hasan', phone: '01925000015' },
];

const CATEGORIES_DATA = [
  { name: 'Electronics & Gadgets', slug: 'demo-electronics', description: 'Smart devices, audio gear, and electronic essentials.' },
  { name: 'Fashion & Apparel', slug: 'demo-fashion', description: 'Traditional and contemporary attire, footwear, and accessories.' },
  { name: 'Home & Living', slug: 'demo-home', description: 'Modern decor, kitchenware, and smart home appliances.' },
  { name: 'Beauty & Personal Care', slug: 'demo-beauty', description: 'Skincare, organic wellness, and grooming products.' },
  { name: 'Groceries & Gourmet', slug: 'demo-groceries', description: 'Premium spices, organic tea, and artisan pantry essentials.' },
];

const PRODUCTS_DATA = [
  {
    sku: 'DEMO-SMW-01',
    slug: 'demo-smart-watch-pro',
    name: 'Aura Pro Smart Watch AMOLED',
    categorySlug: 'demo-electronics',
    price: '4850.00',
    stock: 45,
    lowStockAt: 10,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80',
  },
  {
    sku: 'DEMO-ANC-02',
    slug: 'demo-wireless-anc-headphones',
    name: 'SonicWave Hybrid ANC Headphones',
    categorySlug: 'demo-electronics',
    price: '3490.00',
    stock: 28,
    lowStockAt: 8,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80',
  },
  {
    sku: 'DEMO-SHIRT-03',
    slug: 'demo-premium-cotton-panjabi',
    name: 'Artisan Embroidered Cotton Panjabi',
    categorySlug: 'demo-fashion',
    price: '2850.00',
    stock: 15,
    lowStockAt: 5,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&q=80',
  },
  {
    sku: 'DEMO-SAREE-04',
    slug: 'demo-jamdani-silk-saree',
    name: 'Handwoven Pure Jamdani Saree',
    categorySlug: 'demo-fashion',
    price: '9500.00',
    stock: 4, // LOW STOCK ALERT
    lowStockAt: 5,
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=80',
  },
  {
    sku: 'DEMO-DIFF-05',
    slug: 'demo-ceramic-aroma-diffuser',
    name: 'Nordic Ultrasonic Aroma Diffuser',
    categorySlug: 'demo-home',
    price: '1950.00',
    stock: 32,
    lowStockAt: 6,
    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&q=80',
  },
  {
    sku: 'DEMO-SERUM-06',
    slug: 'demo-vitamin-c-radiance-serum',
    name: 'BioRadiance 10% Vitamin C Serum',
    categorySlug: 'demo-beauty',
    price: '1250.00',
    stock: 3, // LOW STOCK ALERT
    lowStockAt: 10,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80',
  },
  {
    sku: 'DEMO-TEA-07',
    slug: 'demo-organic-sreemangal-tea',
    name: 'Artisan First Flush Sreemangal Black Tea (250g)',
    categorySlug: 'demo-groceries',
    price: '650.00',
    stock: 0, // OUT OF STOCK
    lowStockAt: 15,
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&q=80',
  },
  {
    sku: 'DEMO-HONEY-08',
    slug: 'demo-raw-sundarban-honey',
    name: 'Pure Wild Sundarban Mangrove Honey (500g)',
    categorySlug: 'demo-groceries',
    price: '890.00',
    stock: 22,
    lowStockAt: 8,
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&q=80',
  },
];

async function main() {
  console.log('--- Starting Realistic 60-Day Dashboard Demo Seeder ---');

  // Idempotent clean first
  await cleanDashboardDemo(prisma);

  // 1. Ensure Super Admin exists for demo preview
  const adminEmail = 'admin@demo.local';
  let admin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const passwordHash = await hashPassword('AdminPass123456789!');
    admin = await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: AdminRole.SUPER_ADMIN,
        isActive: true,
      },
    });
    console.log(`Created demo super admin: ${adminEmail} (password: AdminPass123456789!)`);
  }

  // 2. Seed Categories
  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES_DATA) {
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      },
    });
    categoryMap.set(cat.slug, created.id);
  }
  console.log(`Created ${categoryMap.size} categories.`);

  // 3. Seed Products & Inventory
  const productMap = new Map<string, { id: string; name: string; sku: string; price: string }>();
  for (const prod of PRODUCTS_DATA) {
    const catId = categoryMap.get(prod.categorySlug);
    const created = await prisma.product.create({
      data: {
        name: prod.name,
        slug: prod.slug,
        sku: prod.sku,
        price: prod.price,
        categoryId: catId,
        images: {
          create: [{ url: prod.image, isPrimary: true, sortOrder: 0 }],
        },
        inventory: {
          create: {
            quantity: prod.stock,
            lowStockAt: prod.lowStockAt,
            reserved: Math.min(2, prod.stock),
          },
        },
      },
    });
    productMap.set(prod.sku, {
      id: created.id,
      name: created.name,
      sku: created.sku,
      price: prod.price,
    });
  }
  console.log(`Created ${productMap.size} products with inventory.`);

  // 4. Seed Customers
  const customerList: Array<{ id: string; name: string; phone: string }> = [];
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const c = CUSTOMER_NAMES[i];
    const created = await prisma.customer.create({
      data: {
        firstName: c.first,
        lastName: c.last,
        email: `demo-customer-${i + 1}@demo.local`,
        phone: c.phone,
        createdAt: new Date(Date.now() - (55 - i * 3) * 86400000),
      },
    });
    customerList.push({ id: created.id, name: `${c.first} ${c.last}`, phone: c.phone });
  }
  console.log(`Created ${customerList.length} customers.`);

  // 5. Seed 60 Days of Orders
  const products = Array.from(productMap.values());
  const paymentMethods: OrderPaymentMethod[] = [
    OrderPaymentMethod.BKASH,
    OrderPaymentMethod.NAGAD,
    OrderPaymentMethod.COD,
    OrderPaymentMethod.SSLCOMMERZ,
  ];

  const statuses: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
  ];

  const now = Date.now();
  let orderCounter = 1000;
  let totalOrderCount = 0;

  for (let dayOffset = 59; dayOffset >= 0; dayOffset--) {
    // Generate 2-5 orders per day, ramping up closer to today
    const volumeFactor = dayOffset < 7 ? 6 : dayOffset < 30 ? 4 : 2;
    const ordersForDay = Math.floor(Math.random() * 3) + volumeFactor;

    for (let o = 0; o < ordersForDay; o++) {
      orderCounter++;
      totalOrderCount++;

      const orderTime = new Date(now - dayOffset * 86400000 + Math.random() * 80000000);
      const customer = customerList[Math.floor(Math.random() * customerList.length)];
      const district = BANGLADESH_DISTRICTS[Math.floor(Math.random() * BANGLADESH_DISTRICTS.length)];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const status = dayOffset > 10 ? OrderStatus.DELIVERED : statuses[Math.floor(Math.random() * statuses.length)];
      const paymentStatus =
        status === OrderStatus.CANCELLED
          ? OrderPaymentStatus.CANCELLED
          : status === OrderStatus.PENDING && paymentMethod === OrderPaymentMethod.COD
            ? OrderPaymentStatus.UNPAID
            : OrderPaymentStatus.PAID;

      // Select 1 to 3 items
      const itemCount = Math.floor(Math.random() * 2) + 1;
      const orderItems = [];
      let subtotal = 0;

      for (let itemIdx = 0; itemIdx < itemCount; itemIdx++) {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 2) + 1;
        const lineTotal = Number(prod.price) * qty;
        subtotal += lineTotal;
        orderItems.push({
          productId: prod.id,
          skuSnapshot: prod.sku,
          nameSnapshot: prod.name,
          quantity: qty,
          unitPrice: prod.price,
          lineTotal: lineTotal.toFixed(2),
        });
      }

      const shipping = district === 'Dhaka' ? 60 : 120;
      const grandTotal = subtotal + shipping;

      const createdOrder = await prisma.order.create({
        data: {
          orderNumber: `DEMO-${orderCounter}`,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: `demo-customer@demo.local`,
          paymentMethod,
          paymentOption: paymentMethod === OrderPaymentMethod.BKASH ? '01711000000' : null,
          status,
          paymentStatus,
          currency: 'BDT',
          subtotal: subtotal.toFixed(2),
          shippingTotal: shipping.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
          placedAt: orderTime,
          createdAt: orderTime,
          addresses: {
            create: {
              type: 'SHIPPING',
              recipientName: customer.name,
              phone: customer.phone,
              line1: 'House 12, Road 4',
              city: district,
              district,
              countryCode: 'BD',
            },
          },
          items: {
            create: orderItems,
          },
        },
      });

      // Add a refund for a small percentage of delivered orders
      if (status === OrderStatus.DELIVERED && Math.random() < 0.08) {
        const refundAmt = Math.min(grandTotal, 500);
        await prisma.orderPaymentTransaction.create({
          data: {
            orderId: createdOrder.id,
            type: 'REFUND',
            status: 'SUCCEEDED',
            provider: 'demo-gateway',
            idempotencyKey: randomUUID(),
            amount: refundAmt.toFixed(2),
            createdAt: new Date(orderTime.getTime() + 86400000),
          },
        });
      }

      // Add order event for activity feed
      await prisma.orderEvent.create({
        data: {
          orderId: createdOrder.id,
          action: status === OrderStatus.DELIVERED ? 'DELIVERED' : status === OrderStatus.CONFIRMED ? 'CONFIRMED' : 'CREATED',
          actorType: 'SYSTEM',
          createdAt: orderTime,
        },
      });
    }
  }
  console.log(`Created ${totalOrderCount} demo orders over 60 days across Bangladesh districts.`);

  // 6. Seed Product Reviews
  const reviews = [
    { prod: products[0], rating: 5, title: '[DEMO] Excellent AMOLED display', content: 'Battery life is superb, lasted over 6 days on a single charge!' },
    { prod: products[1], rating: 4, title: '[DEMO] Great noise cancellation', content: 'Cuts out city traffic nicely, comfortable cushions for long calls.' },
    { prod: products[2], rating: 5, title: '[DEMO] Premium cotton fabric', content: 'Embroidery work is top notch, perfect fit for Friday prayers.' },
    { prod: products[5], rating: 5, title: '[DEMO] Visible glow in two weeks', content: 'Lightweight serum, absorbs fast without any sticky residue.' },
  ];
  for (const r of reviews) {
    await prisma.productReview.create({
      data: {
        productId: r.prod.id,
        rating: r.rating,
        title: r.title,
        content: r.content,
        authorName: 'Verified Buyer',
        authorEmail: 'verified@demo.local',
        status: 'APPROVED',
      },
    });
  }

  // 7. Seed Analytics Events for Conversion Funnel & Traffic Sources
  const trafficSources = ['direct', 'organic', 'social', 'referral', 'email', 'paid'];
  for (let s = 0; s < 120; s++) {
    const sessionId = randomUUID();
    const source = trafficSources[Math.floor(Math.random() * trafficSources.length)];
    const sessionDate = new Date(now - Math.random() * 25 * 86400000);

    await prisma.analyticsSession.create({
      data: {
        id: sessionId,
        source,
        createdAt: sessionDate,
      },
    });

    // 100% of sessions view a product
    await prisma.analyticsEvent.create({
      data: {
        id: randomUUID(),
        sessionId,
        kind: 'PRODUCT_VIEW',
        createdAt: sessionDate,
      },
    });

    // 55% add to cart
    if (Math.random() < 0.55) {
      await prisma.analyticsEvent.create({
        data: {
          id: randomUUID(),
          sessionId,
          kind: 'ADD_TO_CART',
          createdAt: new Date(sessionDate.getTime() + 120000),
        },
      });

      // 35% start checkout
      if (Math.random() < 0.65) {
        await prisma.analyticsEvent.create({
          data: {
            id: randomUUID(),
            sessionId,
            kind: 'CHECKOUT',
            createdAt: new Date(sessionDate.getTime() + 300000),
          },
        });
      }
    }
  }
  console.log('Created analytics sessions and funnel events.');

  // 8. Seed Monthly Target
  const localDhaka = new Date(now + 6 * 3600000);
  const currentMonthStr = `${localDhaka.getUTCFullYear()}-${String(localDhaka.getUTCMonth() + 1).padStart(2, '0')}`;
  await prisma.dashboardTarget.upsert({
    where: { month: currentMonthStr },
    create: { month: currentMonthStr, amount: '350000.00' },
    update: { amount: '350000.00' },
  });
  console.log(`Set monthly sales target for ${currentMonthStr}: ৳350,000.00`);

  console.log('--- Demo Data Seeding Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Seeder failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
