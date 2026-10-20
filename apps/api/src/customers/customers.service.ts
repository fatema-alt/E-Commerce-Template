import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, CustomerStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddCustomerNoteDto, CreateAddressDto, CreateCustomerDto, ListCustomersDto, UpdateCustomerDto } from './dto/customer.dto.js';
@Injectable()
export class CustomersService {
 constructor(private readonly db: PrismaService) {}
 private normalizeEmail(v?: string) { return v?.trim().toLowerCase() || null; }
 private normalizePhone(v?: string) { return v?.trim() || null; }
 private async safe<T>(fn: () => Promise<T>): Promise<T> {
   try { return await fn(); } catch (e) {
     if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Email or phone already exists');
     throw e;
   }
 }
 async list(q: ListCustomersDto) {
   const where: Prisma.CustomerWhereInput = { deletedAt: null, ...(q.status ? { status: q.status } : {}), ...(q.search ? { OR: [
     { firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } },
     { email: { contains: q.search, mode: 'insensitive' } }, { phone: { contains: q.search } },
   ] } : {}) };
   const [items,total] = await this.db.$transaction([
     this.db.customer.findMany({ where, select: { id:true,firstName:true,lastName:true,email:true,phone:true,status:true,createdAt:true,updatedAt:true }, orderBy:[{createdAt:'desc'},{id:'desc'}], skip:(q.page-1)*q.limit,take:q.limit }),
     this.db.customer.count({where})
   ]);
   return { items,total,page:q.page,limit:q.limit,totalPages:Math.ceil(total/q.limit) };
 }
 async get(id:string) {
   const item = await this.db.customer.findFirst({ where:{id,deletedAt:null}, include:{addresses:{orderBy:{createdAt:'desc'}},notes:{orderBy:{createdAt:'desc'},take:50},events:{orderBy:{createdAt:'desc'},take:50}} });
   if(!item) throw new NotFoundException('Customer not found');
   return item;
 }
 async create(dto:CreateCustomerDto,actorId:string) {
   return this.safe(()=>this.db.$transaction(async tx=>{
     const item=await tx.customer.create({data:{firstName:dto.firstName.trim(),lastName:dto.lastName?.trim(),email:this.normalizeEmail(dto.email),phone:this.normalizePhone(dto.phone)}});
     await tx.customerAuditEvent.create({data:{customerId:item.id,actorAdminId:actorId,action:'CUSTOMER_CREATED'}});
     return item;
   }));
 }
 async update(id:string,dto:UpdateCustomerDto,actorId:string) {
   await this.get(id);
   return this.safe(()=>this.db.$transaction(async tx=>{
     const item=await tx.customer.update({where:{id},data:{...(dto.firstName!==undefined?{firstName:dto.firstName.trim()}:{}),...(dto.lastName!==undefined?{lastName:dto.lastName.trim()}:{}),...(dto.email!==undefined?{email:this.normalizeEmail(dto.email)}:{}),...(dto.phone!==undefined?{phone:this.normalizePhone(dto.phone)}:{}),...(dto.status!==undefined?{status:dto.status}:{})}});
     await tx.customerAuditEvent.create({data:{customerId:id,actorAdminId:actorId,action:'CUSTOMER_UPDATED',metadata:{fields:Object.keys(dto)}}});
     return item;
   }));
 }
 async addNote(id:string,dto:AddCustomerNoteDto,actorId:string) {
   await this.get(id);
   return this.db.$transaction(async tx=>{
     const note=await tx.customerNote.create({data:{customerId:id,body:dto.body.trim(),createdByAdminId:actorId}});
     await tx.customerAuditEvent.create({data:{customerId:id,actorAdminId:actorId,action:'NOTE_ADDED'}});
     return note;
   });
 }
 async addAddress(id:string,dto:CreateAddressDto,actorId:string) {
   await this.get(id);
   return this.db.$transaction(async tx=>{
     const address=await tx.customerAddress.create({data:{...dto,countryCode:dto.countryCode.toUpperCase(),customerId:id}});
     await tx.customerAuditEvent.create({data:{customerId:id,actorAdminId:actorId,action:'ADDRESS_ADDED'}});
     return address;
   });
 }
 async archive(id:string,actorId:string) {
   await this.get(id);
   return this.db.$transaction(async tx=>{
     const item=await tx.customer.update({where:{id},data:{status:CustomerStatus.ARCHIVED,deletedAt:new Date()}});
     await tx.customerAuditEvent.create({data:{customerId:id,actorAdminId:actorId,action:'CUSTOMER_ARCHIVED'}});
     return {id:item.id,archived:true};
   });
 }
}
