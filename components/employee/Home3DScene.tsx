import { motion } from "motion/react";

export function Home3DScene() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
      {/* Ground */}
      <ellipse cx="60" cy="100" rx="40" ry="8" fill="#95A5A6" opacity="0.3" />
      
      {/* House Base - Front Wall */}
      <path
        d="M 30 70 L 30 95 L 90 95 L 90 70 Z"
        fill="#E67E22"
      />
      
      {/* House Base - Side Wall */}
      <path
        d="M 90 70 L 110 60 L 110 85 L 90 95 Z"
        fill="#D35400"
      />
      
      {/* Roof - Front */}
      <path
        d="M 25 70 L 60 45 L 95 70 Z"
        fill="#C0392B"
      />
      
      {/* Roof - Side */}
      <path
        d="M 95 70 L 60 45 L 115 35 L 115 60 Z"
        fill="#922B21"
      />
      
      {/* Chimney */}
      <g>
        <rect x="75" y="50" width="8" height="15" fill="#7F8C8D" />
        <rect x="73" y="48" width="12" height="3" fill="#5D6D7E" />
        
        {/* Smoke */}
        <motion.path
          d="M 79 45 Q 77 40 79 35"
          stroke="#95A5A6"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
          animate={{
            y: [0, -5, -10],
            opacity: [0.6, 0.3, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeOut"
          }}
        />
        <motion.path
          d="M 82 45 Q 84 40 82 35"
          stroke="#95A5A6"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
          animate={{
            y: [0, -5, -10],
            opacity: [0.6, 0.3, 0]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.5
          }}
        />
      </g>
      
      {/* Door */}
      <g>
        <rect x="45" y="75" width="15" height="20" fill="#8B4513" rx="1" />
        <circle cx="56" cy="85" r="1" fill="#F39C12" />
        
        {/* Door Window */}
        <rect x="48" y="78" width="4" height="5" fill="#87CEEB" opacity="0.4" rx="0.5" />
        <rect x="53" y="78" width="4" height="5" fill="#87CEEB" opacity="0.4" rx="0.5" />
      </g>
      
      {/* Windows */}
      <g>
        {/* Left Window */}
        <rect x="35" y="78" width="8" height="10" fill="#F9E79F" rx="0.5" />
        <motion.rect
          x="35"
          y="78"
          width="8"
          height="10"
          fill="#F39C12"
          opacity="0.6"
          rx="0.5"
          animate={{
            opacity: [0.4, 0.7, 0.4]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <line x1="39" y1="78" x2="39" y2="88" stroke="#D68910" strokeWidth="0.5" />
        <line x1="35" y1="83" x2="43" y2="83" stroke="#D68910" strokeWidth="0.5" />
        
        {/* Right Window */}
        <rect x="62" y="78" width="8" height="10" fill="#F9E79F" rx="0.5" />
        <motion.rect
          x="62"
          y="78"
          width="8"
          height="10"
          fill="#F39C12"
          opacity="0.6"
          rx="0.5"
          animate={{
            opacity: [0.4, 0.7, 0.4]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        <line x1="66" y1="78" x2="66" y2="88" stroke="#D68910" strokeWidth="0.5" />
        <line x1="62" y1="83" x2="70" y2="83" stroke="#D68910" strokeWidth="0.5" />
        
        {/* Side Window */}
        <rect x="95" y="73" width="10" height="8" fill="#F9E79F" rx="0.5" />
        <motion.rect
          x="95"
          y="73"
          width="10"
          height="8"
          fill="#F39C12"
          opacity="0.5"
          rx="0.5"
          animate={{
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </g>
      
      {/* Garden */}
      <g>
        {/* Grass patches */}
        <ellipse cx="20" cy="98" rx="8" ry="3" fill="#27AE60" opacity="0.4" />
        <ellipse cx="100" cy="96" rx="6" ry="2" fill="#27AE60" opacity="0.4" />
        
        {/* Flowers */}
        <motion.circle
          cx="18"
          cy="97"
          r="1.5"
          fill="#E74C3C"
          animate={{
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity
          }}
        />
        <motion.circle
          cx="22"
          cy="97"
          r="1.5"
          fill="#F39C12"
          animate={{
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: 0.3
          }}
        />
        <motion.circle
          cx="20"
          cy="99"
          r="1.5"
          fill="#9B59B6"
          animate={{
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: 0.6
          }}
        />
      </g>
      
      {/* Mailbox */}
      <g transform="translate(95, 75)">
        {/* Post */}
        <rect x="0" y="10" width="2" height="15" fill="#7F8C8D" />
        
        {/* Box */}
        <rect x="-2" y="8" width="6" height="4" fill="#3498DB" rx="0.5" />
        <rect x="-2" y="8" width="6" height="1" fill="#2980B9" rx="0.5" />
      </g>
      
      {/* Tree */}
      <g transform="translate(-10, 10)">
        {/* Trunk */}
        <rect x="12" y="70" width="4" height="15" fill="#8B4513" rx="1" />
        
        {/* Leaves - Multiple layers for 3D effect */}
        <motion.ellipse
          cx="14"
          cy="68"
          rx="8"
          ry="10"
          fill="#27AE60"
          animate={{
            scale: [1, 1.03, 1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.ellipse
          cx="14"
          cy="65"
          rx="6"
          ry="8"
          fill="#229954"
          animate={{
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5
          }}
        />
        <motion.ellipse
          cx="14"
          cy="62"
          rx="5"
          ry="6"
          fill="#27AE60"
          animate={{
            scale: [1, 1.04, 1]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </g>
      
      {/* Moon/Sun in sky */}
      <motion.circle
        cx="25"
        cy="30"
        r="6"
        fill="#F39C12"
        animate={{
          fill: ["#F39C12", "#F1C40F", "#F39C12"]
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Stars (evening) */}
      <motion.g
        animate={{
          opacity: [0.3, 0.8, 0.3]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <circle cx="40" cy="25" r="0.8" fill="#F1C40F" />
        <circle cx="50" cy="20" r="0.6" fill="#F1C40F" />
        <circle cx="35" cy="35" r="0.7" fill="#F1C40F" />
      </motion.g>
    </svg>
  );
}
