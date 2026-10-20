import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { CustomersService } from './customers.service.js';
import { AddCustomerNoteDto, CreateAddressDto, CreateCustomerDto, ListCustomersDto, UpdateCustomerDto } from './dto/customer.dto.js';
type AdminRequest = Request & { admin?: {id:string;role:string;email:string} };
const editors = SetMetadata('roles',['SUPER_ADMIN','ADMIN']);
@Controller('customers')
export class CustomersController {
 constructor(private readonly service:CustomersService) {}
 @Get() list(@Query() q:ListCustomersDto) { return this.service.list(q); }
 @Get(':id') get(@Param('id') id:string) { return this.service.get(id); }
 @Post() @editors create(@Body() dto:CreateCustomerDto,@Req() req:AdminRequest) { return this.service.create(dto,req.admin!.id); }
 @Patch(':id') @editors update(@Param('id') id:string,@Body() dto:UpdateCustomerDto,@Req() req:AdminRequest) { return this.service.update(id,dto,req.admin!.id); }
 @Post(':id/notes') @editors note(@Param('id') id:string,@Body() dto:AddCustomerNoteDto,@Req() req:AdminRequest) { return this.service.addNote(id,dto,req.admin!.id); }
 @Post(':id/addresses') @editors address(@Param('id') id:string,@Body() dto:CreateAddressDto,@Req() req:AdminRequest) { return this.service.addAddress(id,dto,req.admin!.id); }
 @Delete(':id') @SetMetadata('roles',['SUPER_ADMIN']) archive(@Param('id') id:string,@Req() req:AdminRequest) { return this.service.archive(id,req.admin!.id); }
}
