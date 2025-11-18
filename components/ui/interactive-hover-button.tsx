import { ArrowRight } from "lucide-react"

import { cn } from "@/lib/utils"

export function InteractiveHoverButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "group bg-[#0C1A32] relative w-auto cursor-pointer overflow-hidden rounded-full border py-5 px-20 text-center font-semibold",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-5">
        <div className="bg-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:bg-gradient-to-r from-white via-[#0B1932] to-[#BF0C0E] h-2 w-2 rounded-full transition-all duration-500 group-hover:scale-[100.8]"></div>
        <span className="inline-block transition-all tracking-widest duration-500 text-3xl uppercase group-hover:translate-x-12 group-hover:opacity-0 ">
          {children}
        </span>
      </div>
      <div className="text-primary-foreground absolute top-0 tracking-widest z-10 gap-5 text-2xl uppercase flex h-full w-full translate-x-12 items-center justify-center gap-2 opacity-0 transition-all duration-500 group-hover:-translate-x-20 group-hover:opacity-100">
        <span> Assemble !</span>
        <ArrowRight />
      </div>
    </button>
  )
}
