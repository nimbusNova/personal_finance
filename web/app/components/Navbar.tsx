'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivacy } from '@/app/context/PrivacyContext';
import { getSettings } from '@/lib/api';
import {
  Menu, X, LayoutDashboard, Upload, PieChart, Receipt,
  Eye, EyeOff, ChevronDown, Settings, User, Zap,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const topNavItems = [
  { href: '/upload', label: 'Upload', icon: Upload },
];

const dashboardSubItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/holdings', label: 'Holdings', icon: PieChart },
  { href: '/transactions', label: 'Spending', icon: Receipt },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dashOpen, setDashOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [usageCost, setUsageCost] = useState<number | null>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { showAmounts, togglePrivacy } = usePrivacy();

  useEffect(() => {
    getSettings()
      .then((data) => setUserName(data.user_name || ''))
      .catch(() => setUserName(''));
    fetch('/api/ai/usage/summary')
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.monthToDateCost === 'number') {
          setUsageCost(data.monthToDateCost);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dashRef.current && !dashRef.current.contains(e.target as Node)) {
        setDashOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isDashboardActive = dashboardSubItems.some((i) => pathname === i.href);

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
              {/* Dashboard dropdown */}
              <div className="relative" ref={dashRef}>
                <button
                  onClick={() => setDashOpen((prev) => !prev)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition',
                    isDashboardActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  )}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                  <ChevronDown className={cn('w-3 h-3 transition', dashOpen && 'rotate-180')} />
                </button>
                {dashOpen && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-gray-800 border border-gray-700 rounded-md shadow-lg overflow-hidden z-50">
                    {dashboardSubItems.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setDashOpen(false)}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 text-sm transition',
                            active
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
                )}
              </div>

              {topNavItems.map((item) => {
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
            {userName && (
              <span className="text-sm text-gray-400 mr-2 flex items-center gap-1">
                <User className="w-4 h-4" />
                Welcome, {userName}
              </span>
            )}
            <Link
              href="/usage"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
              title="AI Usage"
            >
              <Zap className="w-4 h-4 text-yellow-400" />
              {usageCost !== null && usageCost > 0 ? `$${usageCost.toFixed(2)}` : '—'}
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <button
              onClick={togglePrivacy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
              title={showAmounts ? 'Hide amounts' : 'Show amounts'}
            >
              {showAmounts ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
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
            {/* Dashboard group */}
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Dashboard
            </div>
            {dashboardSubItems.map((item) => {
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
            {/* Other top-level items */}
            {topNavItems.map((item) => {
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
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition"
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
