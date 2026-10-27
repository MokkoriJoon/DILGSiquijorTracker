import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useFilters } from '../context/FilterContext';
import { Filter, X, ChevronDown, Check } from 'lucide-react';

export default function FloatingFilterIndicator() {
  const location = useLocation();
  const { filters, setFilter, clearFilter, clearAllFilters, activeFiltersCount } = useFilters();
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show on Dashboard page
  if (location.pathname !== '/dashboard') {
    return null;
  }

  // Define all available filter options
  const filterOptions: Record<string, {
    label: string;
    icon: string;
    options: string[];
    color: 'blue' | 'purple' | 'green' | 'orange';
  }> = {
    statusFilter: {
      label: 'Status',
      icon: '📊',
      options: ['ALL', 'PENDING', 'COMPLETED', 'OVERDUE'],
      color: 'blue',
    },
    recurrenceFilter: {
      label: 'Recurrence',
      icon: '🔄',
      options: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMESTER', 'YEARLY', 'ONCE'],
      color: 'purple',
    },
    categoryFilter: {
      label: 'Category',
      icon: '📁',
      options: ['Reporting', 'LGU Compliance', 'Barangay Governance', 'Peace & Order', 'Disaster Preparedness', 'Capacity Building', 'Finance & Budget', 'Administration', 'Field Operations', 'Performance Review'],
      color: 'green',
    },
    departmentFilter: {
      label: 'Department',
      icon: '🏢',
      options: ['DILG Siquijor Provincial Office', 'Municipality of Siquijor', 'Municipality of Larena', 'Municipality of San Juan', 'Municipality of Enrique Villanueva', 'Municipality of Maria', 'Municipality of Lazi'],
      color: 'orange',
    },
  };

  const getColorClasses = (color: 'blue' | 'purple' | 'green' | 'orange', isActive: boolean) => {
    const colors = {
      blue: {
        active: 'bg-blue-600 text-white border-blue-600',
        inactive: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
      },
      purple: {
        active: 'bg-purple-600 text-white border-purple-600',
        inactive: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
      },
      green: {
        active: 'bg-green-600 text-white border-green-600',
        inactive: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
      },
      orange: {
        active: 'bg-orange-600 text-white border-orange-600',
        inactive: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
      },
    };
    return isActive ? colors[color].active : colors[color].inactive;
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded Filter Panel */}
      {isExpanded && (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[400px] max-h-[600px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                <h3 className="text-base font-bold">Filter Tasks</h3>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="Close filter panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {activeFiltersCount > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-blue-100">
                  {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
                </p>
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-white hover:text-blue-100 font-medium underline"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Filter Options */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[500px]">
            {Object.entries(filterOptions).map(([filterKey, config]) => {
              const currentValue = filters[filterKey as keyof typeof filters];

              return (
                <div key={filterKey} className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{config.icon}</span>
                    <h4 className="text-sm font-semibold text-gray-900">{config.label}</h4>
                    {currentValue && (
                      <button
                        onClick={() => clearFilter(filterKey as keyof typeof filters)}
                        className="ml-auto text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {config.options.map((option) => {
                      const isActive = currentValue === option;
                      return (
                        <button
                          key={option}
                          onClick={() => {
                            if (isActive) {
                              clearFilter(filterKey as keyof typeof filters);
                            } else {
                              setFilter(filterKey as keyof typeof filters, option);
                            }
                          }}
                          className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${getColorClasses(
                            config.color,
                            isActive
                          )} ${isActive ? 'shadow-sm' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{option}</span>
                            {isActive && <Check className="w-3 h-3 flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {activeFiltersCount > 0 && (
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">
                  Showing filtered results
                </p>
                <button
                  onClick={() => {
                    clearAllFilters();
                    setIsExpanded(false);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  Apply & Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`shadow-lg px-4 py-3 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 rounded-full ${
          activeFiltersCount > 0
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-slate-600 hover:bg-slate-700 text-white'
        }`}
        aria-label="Open filter panel"
      >
        <Filter className="w-5 h-5" />
        <span className="text-sm font-semibold">Filter</span>
        {activeFiltersCount > 0 && (
          <span className="bg-white text-blue-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {activeFiltersCount}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
