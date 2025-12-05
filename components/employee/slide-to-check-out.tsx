import { useState, useRef } from "react";
import { motion, useMotionValue, PanInfo } from "motion/react";
import { ArrowLeft } from "lucide-react";

interface SlideToCheckOutProps {
  onComplete: () => void;
  disabled?: boolean;
}

export function SlideToCheckOut({ onComplete, disabled }: SlideToCheckOutProps) {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  

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
      <div
        ref={constraintsRef}
        className="relative h-48 rounded-3xl overflow-hidden shadow-2xl border-2 border-red-300/50 dark:border-red-700/50"
        style={{ background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" }}
      >
        

        

        {/* Animated Scene Background */}
        {/* <div className="absolute inset-0 flex items-center justify-between pointer-events-none px-8">
         
          <motion.div
            style={{ 
              opacity: officeOpacity,
              scale: officeScale
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2"
          >
            <Office3DScene />
          </motion.div>

         
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
        </div> */}

        {/* Path/Road */}
        {/* <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.2 }}>
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
        </svg> */}

        {/* Walking Character */}
        {/* <motion.div
          style={{ x: characterX }}
          className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        >
          <Character3D isWalking={isDragging} direction="left" color="#EF4444" />
        </motion.div> */}

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
        {/* <motion.div
          className="absolute left-8 top-1/2  -translate-y-1/2 pointer-events-none"
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
        </motion.div> */}

        {/* Progress Dots */}
        {/* <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-white/40"
              style={{
                backgroundColor: dotColors[i]
              }}
            />
          ))}
        </div> */}

        
      </div>

      <div className="text-center text-xs text-muted-foreground mt-3">Drag the button to check out</div>
    </div>
  );
}
