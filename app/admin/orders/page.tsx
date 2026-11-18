'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AdminOrders from '@/app/components/admin/AdminOrders';
import { useAdminApi } from '@/app/components/admin/useAdminApi';
function OrdersPage() {
  const api=useAdminApi();const search=useSearchParams();
  return <AdminOrders api={api} initialOrder={search.get('order')}/>;
}
export default function Page() {return <Suspense fallback={<p className="admin-loading">Loading orders…</p>}><OrdersPage/></Suspense>;}
