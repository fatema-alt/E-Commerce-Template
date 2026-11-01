import { IsIn, IsNotEmpty, IsOptional, IsUUID, Matches } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(['today', '7d', '30d', '90d', 'this_month', 'custom'])
  range: 'today' | '7d' | '30d' | '90d' | 'this_month' | 'custom' = '7d';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/)
  to?: string;

  @IsOptional()
  @IsIn(['prev_period', 'none'])
  compare: 'prev_period' | 'none' = 'prev_period';
}

export class DashboardTargetDto {
  @Matches(/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/)
  amount!: string;
}

export class DashboardLayoutDto {
  @IsNotEmpty()
  layout!: Record<string, unknown> | unknown[];
}

export class AnalyticsEventDto {
  @IsUUID('4')
  id!: string;

  @IsUUID('4')
  sessionId!: string;

  @IsIn(['PAGE_VIEW', 'PRODUCT_VIEW', 'ADD_TO_CART', 'CHECKOUT', 'CHECKOUT_START'])
  kind!: string;

  @IsIn(['direct', 'organic', 'social', 'referral', 'email', 'paid'])
  source!: string;
}

