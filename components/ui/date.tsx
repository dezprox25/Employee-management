import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  className?: string
  placeholder?: string
}

function DatePicker({ value, onChange, className, placeholder = "Pick a date" }: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  )

  const handleSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    if (selectedDate && onChange) {
      onChange(format(selectedDate, 'yyyy-MM-dd'))
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full h-12 justify-start text-left font-normal pl-10',
            'bg-white/90 dark:bg-white/5 backdrop-blur-sm',
            'border-ash-300/50 dark:border-white/10',
            'hover:border-ash-400 dark:hover:border-white/20',
            'text-ash-900 dark:text-white',
            'rounded-2xl',
            !date && 'text-ash-400 dark:text-white/30',
            className
          )}
        >
          <CalendarIcon className=" left-4 h-5 w-5 text-ash-500 dark:text-white/60" />
          {date ? format(date, 'PPP') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 bg-white dark:bg-dark-900 rounded-2xl shadow-xl border border-ash-200/50 dark:border-white/10" 
        align="start"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          className="rounded-2xl"
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }