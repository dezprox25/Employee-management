// "use client";
// import { cn } from "@/lib/utils";
// import Image from "next/image";
// import React, { useState, createContext, useContext, useRef } from "react";
// import { AnimatePresence, motion } from "motion/react";
// import { IconMenu2, IconX } from "@tabler/icons-react";

// interface Links {
//   label: string;
//   href: string;
//   icon: React.JSX.Element | React.ReactNode;
// }

// interface SidebarContextProps {
//   open: boolean;
//   setOpen: React.Dispatch<React.SetStateAction<boolean>>;
//   animate: boolean;
// }

// const SidebarContext = createContext<SidebarContextProps | undefined>(
//   undefined
// );

// export const useSidebar = () => {
//   const context = useContext(SidebarContext);
//   if (!context) {
//     throw new Error("useSidebar must be used within a SidebarProvider");
//   }
//   return context;
// };

// export const SidebarProvider = ({
//   children,
//   open: openProp,
//   setOpen: setOpenProp,
//   animate = true,
// }: {
//   children: React.ReactNode;
//   open?: boolean;
//   setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
//   animate?: boolean;
// }) => {
//   const [openState, setOpenState] = useState(false);

//   const open = openProp !== undefined ? openProp : openState;
//   const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

//   return (
//     <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>
//       {children}
//     </SidebarContext.Provider>
//   );
// };

// export const Sidebar = ({
//   children,
//   open,
//   setOpen,
//   animate,
// }: {
//   children: React.ReactNode;
//   open?: boolean;
//   setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
//   animate?: boolean;
// }) => {
//   return (
//     <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
//       {children}
//     </SidebarProvider>
//   );
// };

// export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
//   return (
//     <>
//       <DesktopSidebar {...props} />
//       <MobileSidebar {...(props as React.ComponentProps<"div">)} />
//     </>
//   );
// };

// export const DesktopSidebar = ({
//   className,
//   children,
//   ...props
// }: React.ComponentProps<typeof motion.div>) => {
//   const { open, setOpen, animate } = useSidebar();
//   const closeTimerRef = useRef<number | null>(null);

//   const handleEnter = () => {
//     if (closeTimerRef.current) {
//       clearTimeout(closeTimerRef.current);
//       closeTimerRef.current = null;
//     }
//     setOpen(true);
//   };

//   const handleLeave = () => {
//     // small delay to prevent flicker when cursor briefly leaves the area
//     closeTimerRef.current = window.setTimeout(() => {
//       setOpen(false);
//       closeTimerRef.current = null;
//     }, 150);
//   };
//   return (
//     <>
//       <motion.div
//         className={cn(
//           "h-full px-5 py-3 hidden bg-red-500 h-full  md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[300px] shrink-0",
//           className
//         )}
//         animate={{
//           width: animate ? (open ? "300px" : "100px") : "300px",
//         }}
//         transition={{ duration: 0.3, ease: "easeInOut" }}
//         onPointerEnter={handleEnter}
//         onPointerLeave={handleLeave}
//         {...props}
//       >
//         <div className="flex items-center  justify-start">
//           <a href="/" aria-label="Home" className="flex items-center gap-2">
//             {open ? (
//               <Image
//                 src="/dezprox horizontal black logo.png"
//                 alt="Dezprox"
//                 width={160}
//                 height={32}
//                 priority
//                 className="h-8 w-auto"
//               />
//             ) : (
//               <Image src="/dezproxlogo.png" alt="Dezprox" width={28} height={28} />
//             )}
//           </a>
//         </div>
//         {children}
//       </motion.div>
//     </>
//   );
// };

// export const MobileSidebar = ({
//   className,
//   children,
//   ...props
// }: React.ComponentProps<"div">) => {
//   const { open, setOpen } = useSidebar();
//   return (
//     <>
//       <div
//         className={cn(
//           "h-10 px-4 py-4 flex flex-row md:hidden  items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full"
//         )}
//         {...props}
//       >
//         <div className="flex items-center gap-2">
//           <Image src="/icon.svg" alt="Dezprox" width={24} height={24} />
//         </div>
//         <div className="flex justify-end z-20 w-full">
//           <IconMenu2
//             className="text-neutral-800 dark:text-neutral-200"
//             onClick={() => setOpen(!open)}
//           />
//         </div>
//         <AnimatePresence>
//           {open && (
//             <motion.div
//               initial={{ x: "-100%", opacity: 0 }}
//               animate={{ x: 0, opacity: 1 }}
//               exit={{ x: "-100%", opacity: 0 }}
//               transition={{
//                 duration: 0.3,
//                 ease: "easeInOut",
//               }}
//               className={cn(
//                 "fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 z-[100] flex flex-col justify-between",
//                 className
//               )}
//             >
//               <div
//                 className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200"
//                 onClick={() => setOpen(!open)}
//               >
//                 <IconX />
//               </div>
//               {children}
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </div>
//     </>
//   );
// };

// export const SidebarLink = ({
//   link,
//   className,
//   onClick,
//   ...props
// }: {
//   link: Links;
//   className?: string;
//   onClick?: React.MouseEventHandler<HTMLAnchorElement>;
// }) => {
//   const { open, animate } = useSidebar();
//   return (
//     <a
//       href={link.href}
//       className={cn(
//         "flex items-center justify-start gap-2  group/sidebar py-1",
//         className
//       )}
//       onClick={onClick}
//       {...props}
//     >
//       {link.icon}
      
//       <motion.span
//         animate={{
//           display: animate ? (open ? "inline-block" : "none") : "inline-block",
//           opacity: animate ? (open ? 1 : 0) : 1,
//         }}
//         className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
//       >
//         {link.label}
//       </motion.span>
//     </a>
//   );
// };


"use client"
import { cn } from "@/lib/utils"
import Image from "next/image"
import type React from "react"
import { useState, createContext, useContext } from "react"
import { AnimatePresence, motion } from "motion/react"
import { IconMenu2, IconX } from "@tabler/icons-react"

interface Links {
  label: string
  href: string
  icon: React.JSX.Element | React.ReactNode
}

interface SidebarContextProps {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  animate: boolean
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  animate?: boolean
}) => {
  const [openState, setOpenState] = useState(false)

  const open = openProp !== undefined ? openProp : openState
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState

  return <SidebarContext.Provider value={{ open, setOpen, animate: animate }}>{children}</SidebarContext.Provider>
}

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode
  open?: boolean
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  animate?: boolean
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  )
}

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  // Narrow children type: motion.div allows MotionValue children, but our sidebar expects React nodes.
  type MotionDivChildrenSafeProps = Omit<React.ComponentProps<typeof motion.div>, "children"> & {
    children?: React.ReactNode
  }
  const safeProps = props as MotionDivChildrenSafeProps
  return (
    <>
      <DesktopSidebar {...safeProps} />
      <MobileSidebar {...(safeProps as React.ComponentProps<"div">)} />
    </>
  )
}

type MotionDivChildrenSafeProps = Omit<React.ComponentProps<typeof motion.div>, "children"> & {
  children?: React.ReactNode
}

export const DesktopSidebar = ({ className, children, ...props }: MotionDivChildrenSafeProps) => {
  const { open, setOpen, animate } = useSidebar()

  return (
    <>
      <motion.div
        className={cn(
          "h-full px-5 py-3 hidden md:flex md:flex-col bg-neutral-100 dark:bg-neutral-800 w-[300px] shrink-0",
          className,
        )}
        animate={{
          width: animate ? (open ? "300px" : "60px") : "300px",
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        {...props}
      >
        <div className={cn("flex  items-center justify-between ", open ? "" : "flex-col")} >
          <a href="/" aria-label="Home" className="flex items-center gap-2">
            {open ? (
              <Image
                src="/dezprox horizontal black logo.png"
                alt="Dezprox"
                width={160}
                height={32}
                priority
                className="h-8 w-auto"
              />
            ) : (
              <Image src="/dezproxlogo.png" alt="Dezprox" className="my-5" width={32} height={32} />
            )}
          </a>
          {/* Toggle button for smooth open/close */}
          <motion.button
            onClick={() => setOpen(!open)}
            className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {open ? (
              <IconX size={20} className="text-neutral-700 dark:text-neutral-300" />
            ) : (
              <IconMenu2 size={20} className="text-neutral-700 dark:text-neutral-300" />
            )}
          </motion.button>
        </div>  
        {children}
      </motion.div>
    </>
  )
}

export const MobileSidebar = ({ className, children, ...props }: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar()
  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-neutral-100 dark:bg-neutral-800 w-full",
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <Image src="/icon.svg" alt="Dezprox" width={24} height={24} />
        </div>
        <div className="flex justify-end z-20 w-full">
          <IconMenu2 className="text-neutral-800 dark:text-neutral-200" onClick={() => setOpen(!open)} />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.25,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-white dark:bg-neutral-900 p-10 z-[100] flex flex-col justify-between",
                className,
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-neutral-800 dark:text-neutral-200"
                onClick={() => setOpen(!open)}
              >
                <IconX />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

export const SidebarLink = ({
  link,
  className,
  onClick,
  ...props
}: {
  link: Links
  className?: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}) => {
  const { open, animate } = useSidebar()
  return (
    <a
      href={link.href}
      className={cn("flex items-center justify-start gap-2 group/sidebar py-1", className)}
      onClick={onClick}
      {...props}
    >
      {link.icon}

      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.2 }}
        className="text-neutral-700 dark:text-neutral-200 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </a>
  )
}
