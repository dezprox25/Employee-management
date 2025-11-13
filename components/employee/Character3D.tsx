import { motion } from "motion/react";

interface Character3DProps {
  isWalking?: boolean;
  direction?: "right" | "left";
  color?: string;
}

export function Character3D({ isWalking, direction = "right", color = "#10B981" }: Character3DProps) {
  const scale = direction === "left" ? -1 : 1;
  
  return (
    <motion.div
      animate={isWalking ? {
        y: [0, -3, 0],
      } : {}}
      transition={{
        duration: 0.4,
        repeat: isWalking ? Infinity : 0,
        ease: "easeInOut"
      }}
      style={{ transform: `scaleX(${scale})` }}
    >
      <svg width="80" height="100" viewBox="0 0 80 100" fill="none">
        {/* Shadow */}
        <ellipse 
          cx="40" 
          cy="95" 
          rx="20" 
          ry="4" 
          fill="black" 
          opacity="0.2"
        />
        
        {/* Legs */}
        <g>
          {/* Left Leg */}
          <motion.g
            animate={isWalking ? {
              rotate: [0, -25, 0, 25, 0],
            } : {}}
            transition={{
              duration: 0.6,
              repeat: isWalking ? Infinity : 0,
              ease: "easeInOut"
            }}
            style={{ transformOrigin: "35px 65px" }}
          >
            {/* Thigh */}
            <path
              d="M 35 65 L 32 80 L 34 80 L 37 65 Z"
              fill={color}
              opacity="0.9"
            />
            {/* Shin */}
            <path
              d="M 32 80 L 30 92 L 32 92 L 34 80 Z"
              fill={color}
              opacity="0.8"
            />
            {/* Shoe */}
            <ellipse cx="31" cy="93" rx="4" ry="2.5" fill="#2C3E50" />
          </motion.g>
          
          {/* Right Leg */}
          <motion.g
            animate={isWalking ? {
              rotate: [0, 25, 0, -25, 0],
            } : {}}
            transition={{
              duration: 0.6,
              repeat: isWalking ? Infinity : 0,
              ease: "easeInOut"
            }}
            style={{ transformOrigin: "45px 65px" }}
          >
            {/* Thigh */}
            <path
              d="M 45 65 L 48 80 L 46 80 L 43 65 Z"
              fill={color}
              opacity="0.9"
            />
            {/* Shin */}
            <path
              d="M 48 80 L 50 92 L 48 92 L 46 80 Z"
              fill={color}
              opacity="0.8"
            />
            {/* Shoe */}
            <ellipse cx="49" cy="93" rx="4" ry="2.5" fill="#2C3E50" />
          </motion.g>
        </g>
        
        {/* Body */}
        <g>
          {/* Torso */}
          <path
            d="M 30 40 L 28 65 L 52 65 L 50 40 Z"
            fill={color}
          />
          
          {/* Shirt detail */}
          <rect x="35" y="45" width="10" height="15" fill="white" opacity="0.2" rx="1" />
          
          {/* Arms */}
          {/* Left Arm */}
          <motion.g
            animate={isWalking ? {
              rotate: [0, 20, 0, -20, 0],
            } : {}}
            transition={{
              duration: 0.6,
              repeat: isWalking ? Infinity : 0,
              ease: "easeInOut"
            }}
            style={{ transformOrigin: "28px 45px" }}
          >
            <path
              d="M 28 45 L 22 60 L 24 61 L 30 46 Z"
              fill={color}
              opacity="0.95"
            />
          </motion.g>
          
          {/* Right Arm */}
          <motion.g
            animate={isWalking ? {
              rotate: [0, -20, 0, 20, 0],
            } : {}}
            transition={{
              duration: 0.6,
              repeat: isWalking ? Infinity : 0,
              ease: "easeInOut"
            }}
            style={{ transformOrigin: "52px 45px" }}
          >
            <path
              d="M 52 45 L 58 60 L 56 61 L 50 46 Z"
              fill={color}
              opacity="0.95"
            />
          </motion.g>
        </g>
        
        {/* Neck */}
        <rect x="37" y="35" width="6" height="5" fill="#FFD4A3" rx="1" />
        
        {/* Head */}
        <g>
          {/* Face */}
          <ellipse cx="40" cy="25" rx="12" ry="14" fill="#FFD4A3" />
          
          {/* Hair */}
          <path
            d="M 28 20 Q 28 12 40 10 Q 52 12 52 20 L 52 28 Q 52 15 40 15 Q 28 15 28 28 Z"
            fill="#3E2723"
          />
          
          {/* Eyes */}
          <circle cx="35" cy="24" r="1.5" fill="#2C3E50" />
          <circle cx="45" cy="24" r="1.5" fill="#2C3E50" />
          
          {/* Smile */}
          <path
            d="M 35 29 Q 40 31 45 29"
            stroke="#2C3E50"
            strokeWidth="1"
            fill="none"
            strokeLinecap="round"
          />
        </g>
        
        {/* Backpack */}
        <rect 
          x="48" 
          y="42" 
          width="8" 
          height="12" 
          rx="2" 
          fill="#E74C3C"
          opacity="0.9"
        />
        <rect 
          x="50" 
          y="45" 
          width="4" 
          height="2" 
          rx="0.5" 
          fill="white"
          opacity="0.3"
        />
      </svg>
    </motion.div>
  );
}
