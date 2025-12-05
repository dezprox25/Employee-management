import { useState, useRef } from "react";
import { motion, useMotionValue, PanInfo } from "motion/react";
import { ArrowRight } from "lucide-react";

interface SlideToCheckInProps {
  onComplete: () => void;
  disabled?: boolean;
}

export function SlideToCheckIn({ onComplete, disabled }: SlideToCheckInProps) {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  
  

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
      <div
        ref={constraintsRef}
        className="relative h-48 rounded-3xl overflow-hidden shadow-2xl border-2 border-green-300/50 dark:border-green-700/50"
        style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}
      >

        

        

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

        

        
      </div>

      {/* Helper Text */}
      <div className="text-center text-xs text-muted-foreground mt-3">Drag the button to check in</div>
    </div>
  );
}
