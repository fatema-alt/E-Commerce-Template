import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  SetMetadata,
} from '@nestjs/common';
import type { AdminRequest } from '../auth/auth.guard.js';
import { FinanceService } from './finance.service.js';
import {
  CreateExpenseDto,
  ExpenseQueryDto,
  UpdateExpenseDto,
} from './dto/expense.dto.js';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/category.dto.js';

@Controller('finance')
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  // ==========================================
  // Summary & KPIs
  // ==========================================

  @Get('summary')
  getSummary(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.service.getSummary({ startDate, endDate });
  }

  // ==========================================
  // Expenses Endpoints
  // ==========================================

  @Get('expenses')
  listExpenses(@Query() query: ExpenseQueryDto) {
    return this.service.listExpenses(query);
  }

  @Get('expenses/:id')
  getExpense(@Param('id') id: string) {
    return this.service.getExpense(id);
  }

  @Post('expenses')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  createExpense(@Body() dto: CreateExpenseDto, @Req() req: AdminRequest) {
    return this.service.createExpense(dto, req.admin?.id);
  }

  @Patch('expenses/:id')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  updateExpense(@Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.service.updateExpense(id, dto);
  }

  @Delete('expenses/:id')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  deleteExpense(@Param('id') id: string) {
    return this.service.deleteExpense(id);
  }

  // ==========================================
  // Expense Categories Endpoints
  // ==========================================

  @Get('categories')
  listCategories(@Query('includeInactive') includeInactive?: string) {
    return this.service.listCategories(includeInactive === 'true');
  }

  @Post('categories')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  createCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Patch('categories/:id')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @SetMetadata('roles', ['SUPER_ADMIN', 'ADMIN'])
  deleteCategory(@Param('id') id: string) {
    return this.service.deleteCategory(id);
  }
}
