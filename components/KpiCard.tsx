import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  onClick?: () => void;
  isClickable?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, onClick, isClickable = false }) => {
  const cardClasses = [
    "bg-secondary/30",
    "border",
    "border-border",
    "p-6",
    "rounded-lg",
    "flex",
    "flex-col",
    "justify-between",
    "transition-all",
    isClickable ? "cursor-pointer hover:border-primary/50 hover:bg-secondary/50" : "cursor-default"
  ].join(" ");

  const Comp = isClickable ? 'button' : 'div';

  return (
    <Comp className={cardClasses} onClick={onClick} disabled={!isClickable}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-2 text-left">{value}</p>
    </Comp>
  );
};

export default KpiCard;