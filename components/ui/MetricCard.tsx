import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
}

export function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  iconColor = "text-indigo-600 dark:text-indigo-400",
  iconBgColor = "bg-indigo-100 dark:bg-indigo-950"
}: MetricCardProps) {
  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl">{value}</p>
        </div>
        <div className={`${iconBgColor} p-3 rounded-2xl bg-opacity-60 backdrop-blur-sm border border-white/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </Card>
  );
}