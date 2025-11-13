import { motion } from "motion/react";

export function Office3DScene() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Floor */}
      <path
        d="M 20 100 L 60 80 L 100 100 L 60 120 Z"
        fill="#E8E8E8"
        opacity="0.6"
      />
      
      {/* Desk - Front Face */}
      <path
        d="M 30 75 L 30 85 L 90 85 L 90 75 Z"
        fill="#8B4513"
      />
      
      {/* Desk - Top */}
      <path
        d="M 30 75 L 50 65 L 110 65 L 90 75 Z"
        fill="#A0522D"
      />
      
      {/* Desk - Side */}
      <path
        d="M 90 75 L 110 65 L 110 75 L 90 85 Z"
        fill="#6D3610"
      />
      
      {/* Monitor Stand */}
      <rect
        x="55"
        y="55"
        width="10"
        height="10"
        fill="#34495E"
      />
      
      {/* Monitor */}
      <g>
        {/* Monitor Back */}
        <path
          d="M 45 35 L 75 35 L 75 55 L 45 55 Z"
          fill="#2C3E50"
        />
        
        {/* Monitor Screen */}
        <motion.rect
          x="47"
          y="37"
          width="26"
          height="16"
          fill="#3498DB"
          animate={{
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Screen Content Lines */}
        <rect x="49" y="40" width="10" height="1.5" fill="white" opacity="0.6" />
        <rect x="49" y="43" width="15" height="1.5" fill="white" opacity="0.6" />
        <rect x="49" y="46" width="12" height="1.5" fill="white" opacity="0.6" />
      </g>
      
      {/* Laptop */}
      <g>
        {/* Laptop Base */}
        <motion.path
          d="M 65 68 L 85 62 L 95 62 L 78 68 Z"
          fill="#34495E"
          initial={{ rotateX: 0 }}
        />
        
        {/* Laptop Screen */}
        <motion.path
          d="M 85 62 L 95 62 L 95 50 L 85 50 Z"
          fill="#2C3E50"
          animate={{
            scaleY: [1, 0.95, 1]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Laptop Display */}
        <motion.rect
          x="86"
          y="51"
          width="8"
          height="10"
          fill="#27AE60"
          animate={{
            opacity: [0.7, 1, 0.7]
          }}
          transition={{
            duration: 2,
            repeat: Infinity
          }}
        />
      </g>
      
      {/* Coffee Cup */}
      <g>
        {/* Cup */}
        <ellipse cx="35" cy="73" rx="3" ry="2" fill="#8B4513" />
        <rect x="32" y="68" width="6" height="5" fill="#CD853F" rx="0.5" />
        <ellipse cx="35" cy="68" rx="3" ry="2" fill="#8B4513" />
        
        {/* Steam */}
        <motion.path
          d="M 33 65 Q 32 62 33 60"
          stroke="#BDC3C7"
          strokeWidth="0.8"
          fill="none"
          opacity="0.6"
          animate={{
            y: [0, -3, 0],
            opacity: [0.6, 0, 0.6]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.path
          d="M 37 65 Q 38 62 37 60"
          stroke="#BDC3C7"
          strokeWidth="0.8"
          fill="none"
          opacity="0.6"
          animate={{
            y: [0, -3, 0],
            opacity: [0.6, 0, 0.6]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.3
          }}
        />
      </g>
      
      {/* Office Chair */}
      <g transform="translate(5, 0)">
        {/* Chair Back */}
        <path
          d="M 15 60 L 15 70 L 20 70 L 20 60 Z"
          fill="#E74C3C"
        />
        
        {/* Chair Seat */}
        <ellipse cx="17.5" cy="72" rx="6" ry="3" fill="#C0392B" />
        
        {/* Chair Pole */}
        <line x1="17.5" y1="75" x2="17.5" y2="82" stroke="#7F8C8D" strokeWidth="1.5" />
        
        {/* Chair Base */}
        <ellipse cx="17.5" cy="83" rx="5" ry="1.5" fill="#34495E" />
      </g>
      
      {/* Window */}
      <g transform="translate(5, -10)">
        <rect x="10" y="20" width="20" height="25" fill="#87CEEB" opacity="0.3" rx="1" />
        <line x1="20" y1="20" x2="20" y2="45" stroke="#BDC3C7" strokeWidth="1" />
        <line x1="10" y1="32.5" x2="30" y2="32.5" stroke="#BDC3C7" strokeWidth="1" />
        
        {/* Clouds outside */}
        <motion.ellipse
          cx="17"
          cy="27"
          rx="3"
          ry="2"
          fill="white"
          opacity="0.6"
          animate={{
            x: [0, 5, 0]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </g>
      
      {/* Plant */}
      <g transform="translate(85, 45)">
        {/* Pot */}
        <path
          d="M 8 20 L 6 25 L 14 25 L 12 20 Z"
          fill="#E67E22"
        />
        
        {/* Leaves */}
        <motion.ellipse
          cx="8"
          cy="17"
          rx="2"
          ry="3"
          fill="#27AE60"
          animate={{
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 3,
            repeat: Infinity
          }}
        />
        <motion.ellipse
          cx="11"
          cy="18"
          rx="2"
          ry="3"
          fill="#229954"
          animate={{
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: 0.5
          }}
        />
        <motion.ellipse
          cx="12"
          cy="15"
          rx="2"
          ry="3"
          fill="#27AE60"
          animate={{
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: 1
          }}
        />
      </g>
    </svg>
  );
}
