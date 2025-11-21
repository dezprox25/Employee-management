import { useState, useRef, useEffect, useMemo } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Character3D } from "./Character3D";
import { Home3DScene } from "./Home3DScene";
import { Office3DScene } from "./Office3DScene";

interface SlideToCheckInProps {
  onComplete: () => void;
  disabled?: boolean;
}

export function SlideToCheckIn({ onComplete, disabled }: SlideToCheckInProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [reduceAnimations, setReduceAnimations] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const rafId = useRef<number | null>(null);
  const lastLog = useRef<number>(performance.now());
  const windowSeconds = useRef<{ low: number; high: number }>({ low: 0, high: 0 });
  useEffect(() => {
    let last = performance.now();
    let lowFrames = 0;
    let highFrames = 0;
    let secondsAccum = 0;
    const loop = (t: number) => {
      const dt = t - last;
      last = t;
      const fps = 1000 / Math.max(1, dt);
      secondsAccum += dt;
      if (fps < 55) lowFrames++; else highFrames++;
      if (performance.now() - lastLog.current >= 1000) {
        const mem = (performance as any).memory;
        const used = mem ? Math.round(mem.usedJSHeapSize / 1048576) : null;
        console.debug(`[perf:SlideCheckIn] fps=${fps.toFixed(1)} mem=${used !== null ? used + 'MB' : 'n/a'}`);
        lastLog.current = performance.now();
      }
      if (secondsAccum >= 5000) {
        windowSeconds.current.low = lowFrames;
        windowSeconds.current.high = highFrames;
        setReduceAnimations(lowFrames > highFrames);
        secondsAccum = 0;
        lowFrames = 0;
        highFrames = 0;
      }
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, []);
  
  const background = useTransform(
    x,
    [0, 300],
    ["linear-gradient(135deg, #10b981 0%, #059669 100%)", "linear-gradient(135deg, #059669 0%, #047857 100%)"]
  );
  
  const sceneProgress = useTransform(x, [0, 300], [0, 1]);
  const homeOpacity = useTransform(x, [0, 150], [1, 0]);
  const homeScale = useTransform(x, [0, 150], [1, 0.7]);
  const officeOpacity = useTransform(x, [150, 300], [0, 1]);
  const officeScale = useTransform(x, [150, 300], [0.7, 1]);
  const characterX = useTransform(x, [0, 300], [0, 200]);
  const dotColor0 = useTransform(sceneProgress, [0.0, 0.2], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor1 = useTransform(sceneProgress, [0.2, 0.4], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor2 = useTransform(sceneProgress, [0.4, 0.6], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor3 = useTransform(sceneProgress, [0.6, 0.8], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor4 = useTransform(sceneProgress, [0.8, 1.0], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColors = [dotColor0, dotColor1, dotColor2, dotColor3, dotColor4];
  const roadDuration = reduceAnimations ? 3 : 2;

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    if (info.offset.x > 250) {
      onComplete();
      setTimeout(() => x.set(0), 500);
    } else {
      x.set(0);
    }
  };

  return (
    <div className="relative w-full">
      <motion.div
        ref={constraintsRef}
        className="relative h-48 rounded-3xl overflow-hidden shadow-2xl border-2 border-green-300/50 dark:border-green-700/50"
        style={{ background }}
      >
        {/* Animated Scene Background */}
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-8">
          {/* Home Scene - Left */}
          <motion.div
            style={{ 
              opacity: homeOpacity,
              scale: homeScale,
              x: -30
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2"
          >
            <Home3DScene />
          </motion.div>

          {/* Office Scene - Right */}
          <motion.div
            style={{ 
              opacity: officeOpacity,
              scale: officeScale
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <Office3DScene />
          </motion.div>
        </div>

        {/* Path/Road */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.2 }}>
          <motion.path
            d="M 0 120 Q 150 100 400 120"
            stroke="#ffffff"
            strokeWidth="3"
            strokeDasharray="10 5"
            fill="none"
            animate={{
              strokeDashoffset: [0, -30]
            }}
            transition={{
              duration: roadDuration,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </svg>

        {/* Walking Character */}
        <motion.div
          style={{ x: characterX }}
          className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        >
          <Character3D isWalking={isDragging} direction="right" color="#10B981" />
        </motion.div>

        {/* Sliding Button */}
        <motion.div
          drag="x"
          dragConstraints={constraintsRef}
          dragElastic={0.1}
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-20 ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Glow Effect */}
          <motion.div
            className="absolute inset-0 bg-green-400 rounded-3xl blur-xl"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Button */}
          <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-center">
            {/* 3D Effect Layers */}
            <div className="absolute inset-2 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
            <div className="absolute inset-0 rounded-3xl shadow-inner" />
            
            {/* Icon */}
            <motion.div
              animate={isDragging ? {
                x: [0, 3, 0],
              } : {}}
              transition={{
                duration: 0.3,
                repeat: isDragging ? Infinity : 0
              }}
            >
              <ArrowRight className="size-10 text-white drop-shadow-lg" strokeWidth={3} />
            </motion.div>
          </div>
        </motion.div>

        {/* Instruction Text */}
        <motion.div
          className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none"
          animate={{ 
            opacity: [0.6, 1, 0.6],
            x: [0, 5, 0]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="text-white/90 text-lg font-medium drop-shadow-lg">
            Slide to Start Work →
          </div>
        </motion.div>

        {/* Progress Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
              style={{
                backgroundColor: dotColors[i]
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Helper Text */}
      <motion.div 
        className="text-center text-xs text-muted-foreground mt-3"
        animate={{
          opacity: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 3,
          repeat: Infinity
        }}
      >
        🏠 Drag the button to travel from home to office 💼
      </motion.div>
    </div>
  );
}
