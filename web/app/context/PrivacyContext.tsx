'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface PrivacyContextType {
  showAmounts: boolean;
  togglePrivacy: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

const STORAGE_KEY = 'pf_privacy_show_amounts';

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [showAmounts, setShowAmounts] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setShowAmounts(stored === 'true');
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, String(showAmounts));
    }
  }, [showAmounts, mounted]);

  const togglePrivacy = useCallback(() => {
    setShowAmounts((prev) => !prev);
  }, []);

  return (
    <PrivacyContext.Provider value={{ showAmounts, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) throw new Error('usePrivacy must be used within PrivacyProvider');
  return context;
}
