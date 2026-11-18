'use client';
import AdminOverview from '@/app/components/admin/AdminOverview';
import { useAdminApi } from '@/app/components/admin/useAdminApi';
export default function AdminPage(){return <AdminOverview api={useAdminApi()}/>;}
