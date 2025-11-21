import { useState, useRef, useEffect, useMemo } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Character3D } from "./Character3D";
import { Home3DScene } from "./Home3DScene";
import { Office3DScene } from "./Office3DScene";

interface SlideToCheckOutProps {
  onComplete: () => void;
  disabled?: boolean;
}

export function SlideToCheckOut({ onComplete, disabled }: SlideToCheckOutProps) {
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
        console.debug(`[perf:SlideCheckOut] fps=${fps.toFixed(1)} mem=${used !== null ? used + 'MB' : 'n/a'}`);
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
    [-300, 0],
    ["linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"]
  );
  
  const sceneProgress = useTransform(x, [-300, 0], [1, 0]);
  const officeOpacity = useTransform(x, [-150, 0], [0, 1]);
  const officeScale = useTransform(x, [-150, 0], [0.7, 1]);
  const homeOpacity = useTransform(x, [-300, -150], [1, 0]);
  const homeScale = useTransform(x, [-300, -150], [1, 0.7]);
  const characterX = useTransform(x, [-300, 0], [-200, 0]);
  const skyColor = useTransform(x, [-300, 0], ["#FF6B6B", "#FFA500"]);
  const dotColor0 = useTransform(sceneProgress, [0.0, 0.2], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor1 = useTransform(sceneProgress, [0.2, 0.4], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor2 = useTransform(sceneProgress, [0.4, 0.6], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor3 = useTransform(sceneProgress, [0.6, 0.8], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColor4 = useTransform(sceneProgress, [0.8, 1.0], ["rgba(255,255,255,0.4)", "rgba(255,255,255,1)"]);
  const dotColors = [dotColor0, dotColor1, dotColor2, dotColor3, dotColor4];
  const eveningOpacity = useTransform(x, [-300, -100], [1, 0]);
  const eveningBackground = useTransform(
    x,
    [-300, 0],
    [
      "linear-gradient(to bottom, #1e3a8a 0%, #7c3aed 50%, #ec4899 100%)",
      "transparent",
    ],
  );
  const starsOpacity = useTransform(x, [-300, -150], [1, 0]);
  const roadDuration = reduceAnimations ? 3 : 2;
  const starsData = useMemo(() => {
    return Array.from({ length: 15 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 60}%`,
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 2,
    }));
  }, []);

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    if (info.offset.x < -250) {
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
        className="relative h-48 rounded-3xl overflow-hidden shadow-2xl border-2 border-red-300/50 dark:border-red-700/50"
        style={{ background }}
      >
        {/* Sky Gradient for Evening Effect */}
        <motion.div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: eveningBackground
          }}
        />

        {/* Stars appearing */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: starsOpacity
          }}
        >
          {starsData.slice(0, reduceAnimations ? 8 : 15).map((s, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-yellow-200 rounded-full"
              style={{
                left: s.left,
                top: s.top,
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{
                duration: s.duration,
                repeat: Infinity,
                delay: s.delay
              }}
            />
          ))}
        </motion.div>

        {/* Animated Scene Background */}
        <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-8">
          {/* Office Scene - Left */}
          <motion.div
            style={{ 
              opacity: officeOpacity,
              scale: officeScale
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2"
          >
            <Office3DScene />
          </motion.div>

          {/* Home Scene - Right */}
          <motion.div
            style={{ 
              opacity: homeOpacity,
              scale: homeScale,
              x: 30
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <Home3DScene />
          </motion.div>
        </div>

        {/* Path/Road */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.2 }}>
          <motion.path
            d="M 400 120 Q 250 100 0 120"
            stroke="#ffffff"
            strokeWidth="3"
            strokeDasharray="10 5"
            fill="none"
            animate={{
              strokeDashoffset: [0, 30]
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
          className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        >
          <Character3D isWalking={isDragging} direction="left" color="#EF4444" />
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
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-20 ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Glow Effect */}
          <motion.div
            className="absolute inset-0 bg-red-400 rounded-3xl blur-xl"
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
          <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-red-400 via-red-500 to-rose-600 shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-center">
            {/* 3D Effect Layers */}
            <div className="absolute inset-2 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
            <div className="absolute inset-0 rounded-3xl shadow-inner" />
            
            {/* Icon */}
            <motion.div
              animate={isDragging ? {
                x: [0, -3, 0],
              } : {}}
              transition={{
                duration: 0.3,
                repeat: isDragging ? Infinity : 0
              }}
            >
              <ArrowLeft className="size-10 text-white drop-shadow-lg" strokeWidth={3} />
            </motion.div>
          </div>
        </motion.div>

        {/* Instruction Text */}
        <motion.div
          className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none"
          animate={{ 
            opacity: [0.6, 1, 0.6],
            x: [0, -5, 0]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <div className="text-white/90 text-lg font-medium drop-shadow-lg">
            ← Slide to Go Home
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

        {/* Sun/Moon Transition */}
        <motion.div
          className="absolute top-4 right-12 pointer-events-none"
          style={{
            opacity: eveningOpacity
          }}
        >
          <motion.div
            className="relative w-12 h-12"
            animate={{
              rotate: 360
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
          >
            {/* Sun rays */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-4 bg-yellow-300 rounded-full"
                style={{
                  top: "50%",
                  left: "50%",
                  transformOrigin: "50% 50%",
                  transform: `rotate(${i * 45}deg) translateY(-14px)`
                }}
                animate={{
                  scaleY: [1, 1.3, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.1
                }}
              />
            ))}
            {/* Sun center */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-200 to-orange-400 shadow-lg shadow-orange-400/50" />
          </motion.div>
        </motion.div>
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
        💼 Drag the button to travel back home and relax 🏠
      </motion.div>
    </div>
  );
}
