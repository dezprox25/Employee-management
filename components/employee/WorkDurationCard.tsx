import { motion } from "motion/react";
import { Clock, Zap, TrendingUp } from "lucide-react";
import { memo, useEffect, useMemo, useRef } from "react";

interface WorkDurationCardProps {
  duration: string;
  checkInTime: string;
  animated?: boolean;
}

export function WorkDurationCard({ duration, checkInTime, animated = true }: WorkDurationCardProps) {
  const parsed = useMemo(() => {
    if (typeof duration !== "string") return { hours: 0, minutes: 0, seconds: 0, valid: false };
    const parts = duration.split(":");
    const [h, m, s] = parts;
    const hh = Number(h);
    const mm = Number(m);
    const ss = Number(s);
    const hours = Number.isFinite(hh) && hh >= 0 ? hh : 0;
    const minutes = Number.isFinite(mm) && mm >= 0 ? mm : 0;
    const seconds = Number.isFinite(ss) && ss >= 0 ? ss : 0;
    return { hours, minutes, seconds, valid: parts.length === 3 };
  }, [duration]);

  const hours = parsed.hours;
  const minutes = parsed.minutes;
  const seconds = parsed.seconds;

  const totalMinutes = useMemo(() => Math.max(0, hours * 60 + minutes), [hours, minutes]);
  const progress = useMemo(() => Math.min(Math.max((totalMinutes / 480) * 100, 0), 100), [totalMinutes]);

  const colon1Ref = useRef<HTMLSpanElement>(null);
  const colon2Ref = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) return;
    const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
    let start = performance.now();
    const loop = (now: number) => {
      const t = (now - start) / 1000;
      const a = ease(t % 1);
      const b = ease((t + 0.5) % 1);
      if (colon1Ref.current) colon1Ref.current.style.opacity = String(0.3 + 0.7 * (1 - a));
      if (colon2Ref.current) colon2Ref.current.style.opacity = String(0.3 + 0.7 * (1 - b));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [animated]);
  
  return (
    <motion.div
      className="backdrop-blur-xl bg-gradient-to-br from-green-50/90 to-emerald-50/90 dark:from-green-950/50 dark:to-emerald-950/50 border-2 border-green-200/50 dark:border-green-800/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {/* Animated Background Pulse */}
      {animated && (
        <motion.div
          className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"
          animate={{ 
            scaleX: [0.98, 1, 0.98],
            opacity: [0.7, 1, 0.7]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      
      {animated && (
        <motion.div
          className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          {animated ? (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
            </motion.div>
          ) : (
            <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
          )}
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
          <MemoTimeUnit value={hours} label="hours" />
          <span ref={colon1Ref} className="text-3xl text-green-600 dark:text-green-400">:</span>
          <MemoTimeUnit value={minutes} label="minutes" />
          <span ref={colon2Ref} className="text-3xl text-green-600 dark:text-green-400">:</span>
          <MemoTimeUnit value={seconds} label="seconds" />
        </div>

        {/* Progress Bar */}
        <div className="relative w-full h-3 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full  overflow-hidden"
            initial={{ width: "0%" }}
            animate={animated ? { width: `${progress}%` } : { width: `${progress}%` }}
            transition={animated ? { duration: 1, ease: "easeOut" } : undefined}
          >
            {animated && (
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
            )}
          </motion.div>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          {/* <span>0h</span> */}
          <div className="flex items-center gap-1">
            <Zap className="size-3 text-yellow-500" />
            <span>{Number.isFinite(progress) ? Math.round(progress) : 0}%</span>
          </div>
          {/* <span>8h</span> */}
        </div>
      </div>

      {/* Start Time */}
        <div className="text-sm text-center text-muted-foreground backdrop-blur-sm bg-white/30 dark:bg-black/20 rounded-xl p-3 relative z-10">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Started at {checkInTime || "—"}</span>
        </div>
      </div>
    </motion.div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex  flex-col  items-center">
      {/* <motion.div
        key={value}
        initial={{ scale: 1.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-4xl tabular-nums bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent min-w-[3ch] text-center"
      >
      </motion.div> */}
       <h1 className="text-5xl font-semibold "> {Number.isFinite(value) ? value.toString().padStart(2, "0") : "00"}</h1>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

const MemoTimeUnit = memo(TimeUnit);
