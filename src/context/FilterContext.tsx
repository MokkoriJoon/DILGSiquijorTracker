import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface FilterState {
  statusFilter: string | null;
  recurrenceFilter: string | null;
  categoryFilter: string | null;
  departmentFilter: string | null;
  dateRangeFilter: string | null;
  searchQuery: string;
}

interface FilterContextType {
  filters: FilterState;
  setFilter: (key: keyof FilterState, value: string | null) => void;
  clearFilter: (key: keyof FilterState) => void;
  clearAllFilters: () => void;
  activeFiltersCount: number;
}

const defaultFilters: FilterState = {
  statusFilter: null,
  recurrenceFilter: null,
  categoryFilter: null,
  departmentFilter: null,
  dateRangeFilter: null,
  searchQuery: '',
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const setFilter = (key: keyof FilterState, value: string | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilter = (key: keyof FilterState) => {
    setFilters(prev => ({ ...prev, [key]: key === 'searchQuery' ? '' : null }));
  };

  const clearAllFilters = () => {
    setFilters(defaultFilters);
  };

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value !== null && value !== '' && value !== defaultFilters[key as keyof FilterState]
  ).length;

  return (
    <FilterContext.Provider value={{ filters, setFilter, clearFilter, clearAllFilters, activeFiltersCount }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
