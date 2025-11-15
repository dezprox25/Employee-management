import { RefreshCw, Menu, Search, HelpCircle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useState, useEffect } from "react";

interface DashboardHeaderProps {
  onMenuClick: () => void;
  isEmployee?: boolean;
}

export function DashboardHeader({ onMenuClick, isEmployee = false }: DashboardHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="border-b border-white/50 sticky top-0 z-10 dark:border-white/20 bg-white/70 dark:bg-white/15 backdrop-blur-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="px-6 py-4">
        {/* Top row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl">
                {isEmployee ? "Hello, Employee 👋" : "Hello, Admin 👋"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isEmployee ? "Here's your dashboard today." : "Here's what's going on today."}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">Live updates</span>
                <span className="text-xs text-muted-foreground">
                  Last updated: {formatTime(currentTime)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <div className="relative inline-block group overflow-visible">
              <Button variant="ghost" size="icon" className="rounded-full">
                <HelpCircle className="h-5 w-5" />
              </Button>

              <div className="absolute w-60 -top-8 left-1/2 -translate-x-1/2 
      opacity-0 group-hover:opacity-100 
      transition-all bg-black text-white text-xs px-2 py-1 rounded">
                Need any help contact the Dezprox Team
              </div>
            </div>
          
            <AnimatedThemeToggler className="p-2 rounded-full hover:bg-accent transition-colors" />
          </div>
        </div>

      </div>
    </div>
  );
}