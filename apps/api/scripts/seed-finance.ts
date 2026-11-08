import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

const DEFAULT_CATEGORIES = [
  { name: 'Office & Showroom Rent', code: 'RENT', description: 'দোকান, শোরুম বা গোডাউন ভাড়া', color: '#4f46e5' },
  { name: 'Electricity & Utility Bills', code: 'UTILITIES', description: 'বিদ্যুৎ বিল, পানি, গ্যাস ও সার্ভিস চার্জ', color: '#0284c7' },
  { name: 'Tea, Snacks & Entertainment', code: 'SNACKS', description: 'দোকানের চা, নাস্তা ও অতিথি আপ্যায়ন খরচ', color: '#d97706' },
  { name: 'Staff Salary & Advances', code: 'SALARY', description: 'কর্মচারীদের বেতন, বোনাস ও অগ্রিম', color: '#059669' },
  { name: 'Packaging & Courier Supplies', code: 'PACKAGING', description: 'বক্স, বাবল র‍্যাপ, টেপ, প্যাকিং পলি ইত্যাদি', color: '#7c3aed' },
  { name: 'Local Transport & Conveyance', code: 'CONVEYANCE', description: 'যাতায়াত, রিকশা ও ভ্যান ভাড়া', color: '#ea580c' },
  { name: 'Repair & Maintenance', code: 'MAINTENANCE', description: 'দোকান মেরামত, এসি সার্ভিসিং ও ফিটিংস', color: '#dc2626' },
  { name: 'Marketing & Promotion', code: 'MARKETING', description: 'ফেসবুক বুস্টিং, ব্যানার ও লিফলেট প্রিন্টিং', color: '#db2777' },
  { name: 'Internet & Telecom', code: 'TELECOM', description: 'ওয়াইফাই ব্রডব্যান্ড বিল ও মোবাইল রিচার্জ', color: '#0891b2' },
  { name: 'Stationery & Office Supplies', code: 'STATIONERY', description: 'খাতা, কলম, মেমো প্রিন্টিং ও স্টেশনারি', color: '#475569' },
  { name: 'Miscellaneous / Other Expenses', code: 'MISC', description: 'বিবিধ ফুটফরমাশ খরচ', color: '#64748b' },
];

async function main() {
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.expenseCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: {
        name: cat.name,
        code: cat.code,
        description: cat.description,
        color: cat.color,
        isActive: true,
      },
    });
  }
  const count = await prisma.expenseCategory.count();
  console.log('Total expense categories in database:', count);

  // Check if any sample expense exists, if not create one
  const expCount = await prisma.expense.count();
  console.log('Total expenses currently in ledger:', expCount);

  if (expCount === 0) {
    const rentCat = await prisma.expenseCategory.findUnique({
      where: { name: 'Office & Showroom Rent' },
    });
    if (rentCat) {
      const sample = await prisma.expense.create({
        data: {
          voucherNo: 'EXP-202611-0001',
          title: 'নভেম্বর ২০২৬ মাসের দোকান ও শোরুম ভাড়া',
          amount: 25000,
          categoryId: rentCat.id,
          paymentMethod: 'BANK_TRANSFER',
          paidTo: 'Md. Rafiqul Islam (Landlord)',
          spentBy: 'Admin / Manager',
          receiptNumber: 'RENT-REC-202611',
          notes: 'নভেম্বর মাসের দোকান ভাড়া পরিশোধ করা হলো।',
          status: 'PAID',
        },
      });
      console.log('Sample expense voucher created successfully:', sample.voucherNo, 'Amount:', sample.amount);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
