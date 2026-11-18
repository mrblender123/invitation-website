'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PanelsTopLeft, ReceiptText, Settings2, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../AuthProvider';
import './admin.css';
const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/template-editor', label: 'Templates', icon: PanelsTopLeft },
  { href: '/admin/orders', label: 'Orders', icon: ReceiptText },
  { href: '/admin/tools', label: 'Website Settings', icon: Settings2 },
];
export function AdminFrame({ children, email, pathname }: { children: React.ReactNode; email: string; pathname: string }) {
  return <div className="admin-app"><aside className="admin-sidebar">
    <Link href="/admin" className="admin-brand"><Image src="/brand-logo.png" alt="Share Your Simcha" width={90} height={66} /><span>Business admin</span></Link>
    <nav className="admin-nav" aria-label="Admin navigation">{links.map(({href,label,icon:Icon}) => {
      const active = pathname === href || (href === '/admin/template-editor' && pathname === '/admin/category-fields');
      return <Link key={href} href={href} aria-current={active ? 'page' : undefined}><Icon size={18} aria-hidden="true" />{label}</Link>;
    })}</nav>
    <div className="admin-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer">View website <ArrowUpRight size={12} style={{display:'inline'}} /></a><p>{email}</p></div>
  </aside><div className="admin-content">{children}</div></div>;
}
export default function AdminShell({children}: {children:React.ReactNode}) {
  const {user,loading} = useAuth(); const pathname = usePathname();
  const [slow,setSlow] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(timer); }, []);
  if (loading) return <div className="admin-state-page"><div className="admin-state-card" role="status">{slow ? <><h1>Sign-in is taking longer than expected</h1><p>Please reload to try again.</p><a href="/admin">Reload admin</a></> : 'Checking your admin session…'}</div></div>;
  if (!user || user.email !== 'bycheshin@gmail.com') return <div className="admin-state-page"><div className="admin-state-card"><h1>Admin sign-in required</h1><p>Sign in with your administrator account to manage the website.</p><a href="/login">Go to sign in →</a></div></div>;
  return <AdminFrame email={user.email} pathname={pathname}>{children}</AdminFrame>;
}
