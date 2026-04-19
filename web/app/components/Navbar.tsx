'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { usePrivacy } from '@/app/context/PrivacyContext';
import { Menu, X, LayoutDashboard, Upload, PieChart, Receipt, Lightbulb, LogOut, Eye, EyeOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/holdings', label: 'Holdings', icon: PieChart },
  { href: '/transactions', label: 'Spending', icon: Receipt },
  { href: '/suggestions', label: 'Suggestions', icon: Lightbulb },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { logout } = useAuth();
  const { showAmounts, togglePrivacy } = usePrivacy();

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-white flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-primary-500" />
              Portfolio Intelligence
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition',
                      isActive
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={togglePrivacy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
              title={showAmounts ? 'Hide amounts' : 'Show amounts'}
            >
              {showAmounts ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
          <div className="md:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium transition',
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
