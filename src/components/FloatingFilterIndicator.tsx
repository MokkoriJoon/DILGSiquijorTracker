import React, { useState } from 'react';
import { useFilters } from '../context/FilterContext';
import { Filter, X, ChevronUp, ChevronDown } from 'lucide-react';

export default function FloatingFilterIndicator() {
  const { filters, clearFilter, clearAllFilters, activeFiltersCount } = useFilters();
  const [isExpanded, setIsExpanded] = useState(false);

  if (activeFiltersCount === 0) {
    return null;
  }

  const filterLabels: Record<string, string> = {
    statusFilter: 'Status',
    recurrenceFilter: 'Recurrence',
    categoryFilter: 'Category',
    departmentFilter: 'Department',
    dateRangeFilter: 'Date Range',
    searchQuery: 'Search',
  };

  const getFilterColor = (key: string): string => {
    switch (key) {
      case 'statusFilter':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'recurrenceFilter':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'categoryFilter':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'departmentFilter':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'dateRangeFilter':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'searchQuery':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Expanded Filter Panel */}
      {isExpanded && (
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-4 max-w-xs w-full mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Active Filters</h3>
            <button
              onClick={clearAllFilters}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(filters).map(([key, value]) => {
              if (value === null || value === '') return null;
              
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border ${getFilterColor(key)}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium opacity-75">{filterLabels[key]}</p>
                    <p className="text-sm font-semibold truncate">{value}</p>
                  </div>
                  <button
                    onClick={() => clearFilter(key as keyof typeof filters)}
                    className="ml-2 p-1 hover:bg-white/50 rounded transition-colors"
                    aria-label={`Clear ${filterLabels[key]} filter`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg p-3 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
        aria-label="Toggle filter panel"
      >
        <Filter className="w-5 h-5" />
        <span className="text-sm font-semibold">{activeFiltersCount}</span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
