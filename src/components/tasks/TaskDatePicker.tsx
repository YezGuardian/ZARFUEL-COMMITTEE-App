import React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface TaskDatePickerProps {
  date: string | Date | undefined | null;
  onSelect: (date: Date | undefined) => void;
  label: string;
  disabled?: boolean;
}

const TaskDatePicker: React.FC<TaskDatePickerProps> = ({
  date,
  onSelect,
  label,
  disabled = false
}) => {
  // Convert string date to Date object if needed
  const dateValue = date ? (typeof date === 'string' ? new Date(date) : date) : undefined;
  
  // Handle date selection with proper conversion
  const handleSelect = (newDate: Date | undefined) => {
    // When a date is selected, always pass a Date object
    // This ensures consistency in the form values
    onSelect(newDate);
  };
  
  return (
    <FormItem className="flex flex-col">
      <FormLabel>{label}</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant={"outline"}
              className={cn(
                "pl-3 text-left font-normal",
                !date && "text-muted-foreground"
              )}
              disabled={disabled}
            >
              {dateValue ? (
                format(dateValue, "PPP")
              ) : (
                <span>Pick a date</span>
              )}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            disabled={disabled}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      <FormMessage />
    </FormItem>
  );
};

export default TaskDatePicker;
