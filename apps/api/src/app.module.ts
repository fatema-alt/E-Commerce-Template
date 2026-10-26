import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { AuthModule } from './auth/auth.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { MediaModule } from './media/media.module.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CatalogResponseInterceptor } from './catalog/catalog.interceptor.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { StorefrontController } from './catalog/storefront.controller.js';
import { CustomersModule } from './customers/customers.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { CmsModule } from './cms/cms.module.js';
import { ShopModule } from './shop/shop.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import {
  AnalyticsController,
  DashboardController,
} from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';

@Module({
  imports: [
    PrismaModule,
    MediaModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
    OrdersModule,
    CmsModule,
    ShopModule,
    PaymentsModule,
  ],
  controllers: [
    AppController,
    CatalogController,
    StorefrontController,
    AnalyticsController,
    DashboardController,
  ],
  providers: [
    AppService,
    DashboardService,
    { provide: APP_INTERCEPTOR, useClass: CatalogResponseInterceptor },
  ],
})
export class AppModule {}
