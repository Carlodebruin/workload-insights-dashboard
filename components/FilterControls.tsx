
import React from 'react';
import { User } from '../types';
import { Download, Eraser, PlusCircle } from 'lucide-react';

interface FilterControlsProps {
  users: User[];
  categories: Array<{ value: string; label: string; }>;
  selectedUserId: string;
  setSelectedUserId: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  dateRange: { start: string; end: string };
  setDateRange: (value: { start: string; end: string }) => void;
  onClearFilters: () => void;
  
  // Optional props for extended functionality
  showSearch?: boolean;
  searchTerm?: string;
  setSearchTerm?: (value: string) => void;
  
  showExport?: boolean;
  onExport?: () => void;
  activityCount?: number;

  onLogIncident?: () => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  users,
  categories,
  selectedUserId,
  setSelectedUserId,
  selectedCategory,
  setSelectedCategory,
  dateRange,
  setDateRange,
  onClearFilters,
  showSearch = false,
  searchTerm,
  setSearchTerm,
  showExport = false,
  onExport,
  activityCount,
  onLogIncident,
}) => {
  // Developer sanity checks
  if (showSearch && (searchTerm === undefined || !setSearchTerm)) {
    console.error("FilterControls: 'searchTerm' and 'setSearchTerm' props are required when 'showSearch' is true.");
  }
  if (showExport && (onExport === undefined || activityCount === undefined)) {
    console.error("FilterControls: 'onExport' and 'activityCount' props are required when 'showExport' is true.");
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange({ ...dateRange, [e.target.name]: e.target.value });
  };
  
  const inputStyles = "bg-input border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full";
  const actionButtonStyles = "flex items-center justify-center rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors";
  
  return (
    <div className="p-4 bg-secondary/30 border border-border rounded-lg space-y-4">
       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {showSearch && setSearchTerm && (
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-1">
            <label htmlFor="search-filter" className="block text-sm font-medium text-muted-foreground mb-1">Keyword Search</label>
            <input
              id="search-filter"
              type="text"
              placeholder="Search descriptions, location, staff, category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={inputStyles}
            />
          </div>
        )}
        <div>
          <label htmlFor="user-filter" className="block text-sm font-medium text-muted-foreground mb-1">Staff Member</label>
          <select id="user-filter" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className={inputStyles}>
            <option value="all">All Staff</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category-filter" className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
          <select id="category-filter" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={inputStyles}>
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-muted-foreground mb-1">Start Date</label>
          <input type="date" id="start-date" name="start" value={dateRange.start} onChange={handleDateChange} className={inputStyles} />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-muted-foreground mb-1">End Date</label>
          <input type="date" id="end-date" name="end" value={dateRange.end} onChange={handleDateChange} className={inputStyles} />
        </div>
      </div>

       <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
        <div className="flex flex-wrap items-center gap-3">
            {onLogIncident && (
               <button
                onClick={onLogIncident}
                className={`${actionButtonStyles} bg-green-600 text-white hover:bg-green-700`}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Log Incident
              </button>
            )}
            {showExport && onExport && activityCount !== undefined && (
              <button
                onClick={onExport}
                disabled={activityCount === 0}
                className={`${actionButtonStyles} bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed`}
              >
                <Download className="h-4 w-4 mr-2" />
                Export ({activityCount})
              </button>
            )}
        </div>
        <button
          onClick={onClearFilters}
          className={`${actionButtonStyles} bg-secondary text-secondary-foreground hover:bg-secondary/80`}
        >
          <Eraser className="h-4 w-4 mr-2" />
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default FilterControls;