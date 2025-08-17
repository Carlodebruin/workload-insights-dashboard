import React from 'react';

const SkeletonBox: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`bg-muted/50 rounded-md animate-pulse ${className}`} />
);

const FilterSkeleton: React.FC = () => (
    <div className="p-4 bg-secondary/30 border border-border rounded-lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 items-end">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <SkeletonBox className="h-4 w-2/3 mb-2" />
            <SkeletonBox className="h-9 w-full" />
          </div>
        ))}
        <SkeletonBox className="h-9 w-full" />
        <SkeletonBox className="h-9 w-full" />
      </div>
    </div>
);

const KpiSkeleton: React.FC = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} className="h-[112px]" />)}
    </div>
);

const ChartSkeleton: React.FC = () => (
     <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-5">
        <div className="lg:col-span-2 bg-secondary/30 border border-border p-4 rounded-lg">
           <SkeletonBox className="h-6 w-3/4 mb-4" />
           <SkeletonBox className="h-[300px] w-full" />
        </div>
        <div className="lg:col-span-3 bg-secondary/30 border border-border p-4 rounded-lg">
            <SkeletonBox className="h-6 w-3/4 mb-4" />
            <SkeletonBox className="h-[300px] w-full" />
        </div>
      </div>
);

const FeedSkeleton: React.FC = () => (
    <div>
        <SkeletonBox className="h-8 w-1/3 mb-4" />
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-32" />)}
        </div>
    </div>
);


const DashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-8" aria-label="Loading dashboard data" role="status">
            <FilterSkeleton />
            <KpiSkeleton />
            <ChartSkeleton />
            <FeedSkeleton />
        </div>
    );
};

export default DashboardSkeleton;