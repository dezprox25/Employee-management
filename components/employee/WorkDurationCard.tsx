import { motion } from "motion/react";
import { Clock, Zap, TrendingUp } from "lucide-react";

interface WorkDurationCardProps {
  duration: string;
  checkInTime: string;
}

export function WorkDurationCard({ duration, checkInTime }: WorkDurationCardProps) {
  const [hours, minutes, seconds] = duration.split(":").map(Number);
  
  // Calculate progress (8 hours = 100%)
  const totalMinutes = hours * 60 + minutes;
  const progress = Math.min((totalMinutes / 480) * 100, 100);
  
  return (
    <motion.div
      className="backdrop-blur-xl bg-gradient-to-br from-green-50/90 to-emerald-50/90 dark:from-green-950/50 dark:to-emerald-950/50 border-2 border-green-200/50 dark:border-green-800/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {/* Animated Background Pulse */}
      <motion.div
        className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"
        animate={{ 
          scaleX: [0.98, 1, 0.98],
          opacity: [0.7, 1, 0.7]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      <motion.div
        className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
          </motion.div>
          <span>Active Session</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg text-sm">
          <TrendingUp className="size-3" />
          Live
        </div>
      </div>

      {/* Main Duration Display */}
      <div className="text-center mb-6 relative z-10">
        <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
          <Clock className="size-5" />
          <span className="text-sm">Work Duration</span>
        </div>
        
        {/* Animated Time Display */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <TimeUnit value={hours} label="hours" />
          <motion.span 
            className="text-3xl text-green-600 dark:text-green-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            :
          </motion.span>
          <TimeUnit value={minutes} label="minutes" />
          <motion.span 
            className="text-3xl text-green-600 dark:text-green-400"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
          >
            :
          </motion.span>
          <TimeUnit value={seconds} label="seconds" />
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <motion.div
              className="absolute inset-0 bg-white/30"
              animate={{
                x: ["-100%", "100%"]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear"
              }}
            />
          </motion.div>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>0h</span>
          <div className="flex items-center gap-1">
            <Zap className="size-3 text-yellow-500" />
            <span>{Math.round(progress)}%</span>
          </div>
          <span>8h</span>
        </div>
      </div>

      {/* Start Time */}
      <div className="text-sm text-center text-muted-foreground backdrop-blur-sm bg-white/30 dark:bg-black/20 rounded-xl p-3 relative z-10">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Started at {checkInTime}</span>
        </div>
      </div>
    </motion.div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <motion.div
        key={value}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-4xl tabular-nums bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent min-w-[3ch] text-center"
      >
        {value.toString().padStart(2, "0")}
      </motion.div>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}
