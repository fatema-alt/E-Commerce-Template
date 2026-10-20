import Link from 'next/link';
import {
  ArrowUpRight, BarChart3, Boxes, ChevronRight, CircleHelp,
  CreditCard, FolderTree, MousePointer2, Package, ShoppingBag,
  ShoppingCart, Target, TrendingUp, Users, Wallet,
} from 'lucide-react';

// Presentation-only dashboard. Connect metrics through a secured, server-side
// analytics endpoint before displaying monetary or visitor figures.
const stats = [
  { title: 'Total sales', icon: Wallet, note: 'Net sales after refunds', href: '/orders' },
  { title: 'Total orders', icon: ShoppingBag, note: 'All order statuses', href: '/orders' },
  { title: 'Customers', icon: Users, note: 'Registered customers', href: '/customers' },
  { title: 'Inventory items', icon: Boxes, note: 'Stock across your catalog', href: '/inventory' },
];

const quickLinks = [
  { label: 'Manage orders', href: '/orders', icon: ShoppingCart },
  { label: 'View products', href: '/products', icon: Package },
  { label: 'Manage categories', href: '/categories', icon: FolderTree },
  { label: 'Customer directory', href: '/customers', icon: Users },
];

function Card({ title, action, children, className = '' }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyMetric({ label = 'Analytics integration pending' }: { label?: string }) {
  return <span className="text-xs font-medium text-slate-400">{label}</span>;
}

export default function DashboardPage() {
  return (
    <main className="space-y-5 pb-8 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Store overview</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Your store at a glance, all in one place.</p>
        </div>
        <Link href="/orders" className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
          View orders <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ title, icon: Icon, note, href }) => (
          <Link href={href} key={title} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-slate-500">{title}</span>
              <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><Icon size={18} /></span>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">—</div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">{note}</span>
              <ArrowUpRight size={15} className="shrink-0 text-slate-300 group-hover:text-indigo-600" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card title="Revenue analytics" className="xl:col-span-6" action={<span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">Last 7 days</span>}>
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Revenue</span>
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sky-300" /> Orders</span>
          </div>
          <div className="relative flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 sm:h-56">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-evenly px-4 opacity-60" aria-hidden="true">{[0,1,2,3].map(n => <div key={n} className="border-t border-dashed border-slate-200" />)}</div>
            <div className="relative flex flex-col items-center gap-2 text-center"><BarChart3 size={27} className="text-slate-300" /><EmptyMetric label="Revenue chart available after analytics API integration" /></div>
          </div>
        </Card>

        <Card title="Monthly target" className="xl:col-span-3" action={<Target size={18} className="text-slate-400" />}>
          <div className="flex min-h-52 flex-col items-center justify-center text-center">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-[13px] border-slate-100">
              <div className="flex flex-col items-center gap-1"><span className="text-2xl font-bold text-slate-300">—</span><span className="text-xs text-slate-400">Target progress</span></div>
            </div>
            <p className="mt-5 text-sm font-semibold text-slate-800">Set a monthly sales target</p>
            <p className="mt-1 text-xs text-slate-400">Goal tracking is not configured yet.</p>
          </div>
        </Card>

        <Card title="Top categories" className="xl:col-span-3" action={<Link href="/categories" className="text-xs font-semibold text-indigo-600 hover:underline">See all</Link>}>
          <div className="flex min-h-52 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-[12px] border-slate-100"><FolderTree size={27} className="text-slate-300" /></div>
            <EmptyMetric label="Category sales breakdown not available yet" />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card title="Customer activity" className="xl:col-span-3" action={<Users size={18} className="text-slate-400" />}>
          <div className="space-y-4">
            <div><p className="text-xs text-slate-500">Active customers</p><p className="mt-1 text-3xl font-extrabold text-slate-900">—</p><EmptyMetric /></div>
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {['New customers', 'Returning customers', 'Repeat purchase rate'].map(label => <div key={label} className="flex items-center justify-between gap-3 text-xs"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-400">—</span></div>)}
            </div>
            <Link href="/customers" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">View customers <ChevronRight size={14} /></Link>
          </div>
        </Card>

        <Card title="Conversion funnel" className="xl:col-span-6" action={<span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">This month</span>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Product views', icon: MousePointer2 },
              { label: 'Added to cart', icon: ShoppingCart },
              { label: 'Checkout', icon: CreditCard },
              { label: 'Purchases', icon: ShoppingBag },
            ].map(({ label, icon: Icon }) => <div key={label} className="rounded-xl bg-slate-50 p-3"><Icon size={17} className="text-indigo-500" /><p className="mt-3 text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold text-slate-900">—</p></div>)}
          </div>
          <div className="mt-4 flex min-h-24 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center"><EmptyMetric label="Connect storefront tracking to populate the funnel" /></div>
        </Card>

        <Card title="Traffic sources" className="xl:col-span-3" action={<TrendingUp size={18} className="text-slate-400" />}>
          <div className="mb-5 flex h-8 gap-1 overflow-hidden rounded-lg bg-slate-100" aria-label="Traffic breakdown not available" />
          <div className="space-y-3">
            {['Direct traffic', 'Organic search', 'Social media', 'Referrals', 'Email campaigns'].map(label => <div key={label} className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-400">—</span></div>)}
          </div>
          <div className="mt-5"><EmptyMetric label="Visitor tracking not configured" /></div>
        </Card>
      </div>

      <Card title="Quick access" action={<CircleHelp size={18} className="text-slate-400" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map(({ label, href, icon: Icon }) => <Link href={href} key={href} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40"><span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><Icon size={18} /></span><span className="flex-1 text-sm font-semibold text-slate-700">{label}</span><ChevronRight size={15} className="text-slate-400" /></Link>)}
        </div>
      </Card>
    </main>
  );
}
