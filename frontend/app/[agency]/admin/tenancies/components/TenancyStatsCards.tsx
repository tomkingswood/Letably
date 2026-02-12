'use client';

export interface TenancyStats {
  total: number;
  workflow: number;
  active: number;
  expired: number;
}

export type StatusGroupFilter = 'workflow' | 'active' | 'expired';

interface TenancyStatsCardsProps {
  stats: TenancyStats;
  activeFilter: StatusGroupFilter;
  onFilterChange: (filter: StatusGroupFilter) => void;
}

export default function TenancyStatsCards({ stats, activeFilter, onFilterChange }: TenancyStatsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <button
        onClick={() => onFilterChange('workflow')}
        className={`bg-white rounded-xl p-4 border-2 transition-all ${
          activeFilter === 'workflow' ? 'border-amber-500 shadow-md' : 'border-transparent shadow hover:shadow-md'
        }`}
      >
        <div className="text-3xl font-bold text-amber-600">{stats.workflow}</div>
        <div className="text-sm text-gray-600">Pending Agreements</div>
      </button>
      <button
        onClick={() => onFilterChange('active')}
        className={`bg-white rounded-xl p-4 border-2 transition-all ${
          activeFilter === 'active' ? 'border-green-500 shadow-md' : 'border-transparent shadow hover:shadow-md'
        }`}
      >
        <div className="text-3xl font-bold text-green-600">{stats.active}</div>
        <div className="text-sm text-gray-600">Active</div>
      </button>
      <button
        onClick={() => onFilterChange('expired')}
        className={`bg-white rounded-xl p-4 border-2 transition-all ${
          activeFilter === 'expired' ? 'border-gray-400 shadow-md' : 'border-transparent shadow hover:shadow-md'
        }`}
      >
        <div className="text-3xl font-bold text-gray-500">{stats.expired}</div>
        <div className="text-sm text-gray-600">Expired</div>
      </button>
    </div>
  );
}
