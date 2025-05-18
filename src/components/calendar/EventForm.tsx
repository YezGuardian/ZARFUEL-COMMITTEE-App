import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronDown, Calendar as CalendarIcon, Clock, Search, Plus, X, Loader2 } from 'lucide-react';
import { createMeetingNotification } from '@/utils/notificationService';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { TimePickerWrapper } from './TimePickerWrapper';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

// Updated schema for event form
const eventSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().optional(),
  location: z.string().optional(),
  start_date: z.date(),
  start_time: z.string(),
  end_date: z.date(),
  end_time: z.string(),
  is_meeting: z.boolean().default(false),
  participants: z.array(z.string()).optional(),
  non_user_participants: z.array(z.string()).optional(),
}).refine(data => {
  // Create date objects with times for comparison
  const startDateTime = new Date(data.start_date);
  const endDateTime = new Date(data.end_date);
  
  // Extract hours and minutes from time strings
  const [startHour, startMinute] = data.start_time.split(':').map(Number);
  const [endHour, endMinute] = data.end_time.split(':').map(Number);
  
  // Set the time components
  startDateTime.setHours(startHour, startMinute, 0, 0);
  endDateTime.setHours(endHour, endMinute, 0, 0);
  
  // Check if end date/time is after start date/time
  return endDateTime >= startDateTime;
}, {
  message: "End date/time cannot be before start date/time",
  path: ["end_date"], // Show the error on the end_date field
});

type EventFormValues = z.infer<typeof eventSchema>;

interface EventFormProps {
  onSuccess?: (data: Record<string, any>) => void;
  initialData?: {
    id?: string;
    title?: string;
    description?: string;
    location?: string;
    start_date?: Date;
    start_time?: string;
    end_date?: Date;
    end_time?: string;
    is_meeting?: boolean;
    participants?: string[];
    non_user_participants?: string[];
  };
}

// Participant type can be either a registered user or an external name
type Participant = {
  id: string;
  email: string;
  name: string;
  type: 'user' | 'external';
};

const EventForm: React.FC<EventFormProps> = ({ onSuccess, initialData }) => {
  const { user, isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<Record<string, any>[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(initialData?.participants || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [newParticipantName, setNewParticipantName] = useState('');
  const [nonUserParticipants, setNonUserParticipants] = useState<string[]>(initialData?.non_user_participants || []);
  const [selectedTab, setSelectedTab] = useState<'internal' | 'external'>('internal');

  // Initialize form with default values
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      location: initialData?.location || '',
      start_date: initialData?.start_date ? new Date(initialData.start_date) : new Date(),
      start_time: initialData?.start_time || '09:00',
      end_date: initialData?.end_date ? new Date(initialData.end_date) : new Date(),
      end_time: initialData?.end_time || '10:00',
      is_meeting: initialData?.is_meeting || false,
      participants: initialData?.participants || [],
      non_user_participants: initialData?.non_user_participants || [],
    },
  });

  // Watch for changes to start_date and start_time to update end_date/time if needed
  const startDate = form.watch('start_date');
  const startTime = form.watch('start_time');
  
  // Update end_date and end_time when start values change
  useEffect(() => {
    const endDate = form.getValues('end_date');
    const endTime = form.getValues('end_time');
    
    // If end date is before start date, set end date to start date
    if (endDate < startDate) {
      form.setValue('end_date', new Date(startDate));
      
      // Also update end time to be after start time
      const [startHour, startMinute] = startTime.split(':').map(Number);
      form.setValue('end_time', `${startHour + 1}:${startMinute.toString().padStart(2, '0')}`);
    } 
    // If dates are the same, ensure end time is not before start time
    else if (
      endDate.getFullYear() === startDate.getFullYear() &&
      endDate.getMonth() === startDate.getMonth() &&
      endDate.getDate() === startDate.getDate()
    ) {
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      // If end time is before start time, set end time to 1 hour after start time
      if (endHour < startHour || (endHour === startHour && endMinute < startMinute)) {
        const newEndHour = (startHour + 1) % 24;
        form.setValue('end_time', `${newEndHour}:${startMinute.toString().padStart(2, '0')}`);
      }
    }
  }, [startDate, startTime, form]);

  // Fetch users for participant selection
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .order('first_name');
          
        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    const email = user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return fullName.includes(query) || email.includes(query);
  });

  // Handle form submission
  const onSubmit = async (values: EventFormValues) => {
    if (!user) {
      toast.error('You must be logged in to create an event');
      return;
    }
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Format the start and end datetimes
      const startDate = values.start_date;
      const endDate = values.end_date;
      
      // Create ISO strings for start and end times
      const [startHour, startMinute] = values.start_time.split(':').map(Number);
      const [endHour, endMinute] = values.end_time.split(':').map(Number);
      
      startDate.setHours(startHour, startMinute, 0);
      endDate.setHours(endHour, endMinute, 0);
      
      // Create the event data
      const eventData = {
        title: values.title,
        description: values.description || '',
        location: values.location || '',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        is_meeting: values.is_meeting,
        created_by: user.id
      };
      
      // Add non-user participants to the description if there are any
      if (nonUserParticipants.length > 0) {
        eventData.description = `${eventData.description}\n\nNon-user participants: ${nonUserParticipants.join(', ')}`;
      }
      
      // Insert or update the event
      let eventId;
      
      if (initialData?.id) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', initialData.id);
          
        if (error) throw error;
        eventId = initialData.id;
        
        // Send notification for event update
        try {
          await createMeetingNotification({
            meetingId: eventId,
            meetingTitle: values.title,
            action: 'updated',
            performedBy: user?.user_metadata?.full_name || user?.email || '',
            excludeUserId: user?.id
          });
        } catch (notifError) {
          console.error('Error sending update notification:', notifError);
          // Continue execution even if notification fails
        }
        
        // Delete existing participants to replace them
        if (values.is_meeting) {
          await supabase
            .from('event_participants')
            .delete()
            .eq('event_id', eventId);
        }
      } else {
        try {
          // Check if same event exists within a short time window to prevent duplicates
          const { data: existingEvents } = await supabase
            .from('events')
            .select('id')
            .eq('title', eventData.title)
            .eq('created_by', user.id)
            .gt('created_at', new Date(Date.now() - 5000).toISOString()); // Last 5 seconds
            
          if (existingEvents && existingEvents.length > 0) {
            console.log('Preventing duplicate event creation');
            eventId = existingEvents[0].id;
          } else {
            // Insert new event
            const { data, error } = await supabase
              .from('events')
              .insert([eventData])
              .select('id')
              .single();
              
            if (error) throw error;
            eventId = data.id;
          }
        } catch (insertError: any) {
          // If error is due to duplicate key, try to fetch the existing record
          if (insertError.message && insertError.message.includes('duplicate key value')) {
            console.log('Handling duplicate key error gracefully');
            // Fetch recently created event with same title by this user
            const { data: existingEvent } = await supabase
              .from('events')
              .select('id')
              .eq('title', eventData.title)
              .eq('created_by', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
              
            if (existingEvent && existingEvent.id) {
              eventId = existingEvent.id;
            } else {
              throw insertError; // If we couldn't find it, rethrow the original error
            }
          } else {
            throw insertError;
          }
        }
      }
      
      // If it's a meeting, add participants
      if (values.is_meeting && eventId) {
        // Add internal participants
        if (selectedParticipants.length > 0) {
          const participants = selectedParticipants.map(userId => ({
            event_id: eventId,
            user_id: userId,
            response: 'pending'
          }));
          
          try {
            const { error } = await supabase
              .from('event_participants')
              .insert(participants);
              
            if (error) {
              console.error('Error adding participants:', error);
              // Continue anyway
            }
          } catch (participantError) {
            console.error('Error handling participants:', participantError);
            // Continue anyway - don't block event creation
          }
        }
      }
      
      // Success - call onSuccess first, then show toast
      if (onSuccess) {
        // Prepare the data for onSuccess callback (without problematic fields)
        const successData = {
          ...eventData,
          id: eventId,
          participants: selectedParticipants
        };
        
        await onSuccess(successData);
      }
      
      toast.success(`Event ${initialData ? 'updated' : 'created'} successfully`);
      return true;
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error(`Failed to ${initialData ? 'update' : 'create'} event`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle participant selection
  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Add non-user participant
  const addNonUserParticipant = () => {
    if (!newParticipantName.trim()) return;
    
    // Check if name already exists
    if (nonUserParticipants.includes(newParticipantName)) {
      toast.error('This participant has already been added');
      return;
    }
    
    setNonUserParticipants(prev => [...prev, newParticipantName]);
    setNewParticipantName('');
  };

  // Remove non-user participant
  const removeNonUserParticipant = (name: string) => {
    setNonUserParticipants(prev => prev.filter(p => p !== name));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Event title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Event description (optional)" 
                  className="resize-none" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input placeholder="Location (optional)" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
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
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <TimePickerWrapper 
                      value={field.value} 
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="end_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>End Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
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
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => {
                          const startDate = form.getValues('start_date');
                          return date < startDate;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="end_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time</FormLabel>
                  <FormControl>
                    <TimePickerWrapper 
                      value={field.value} 
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <FormField
          control={form.control}
          name="is_meeting"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>This is a meeting</FormLabel>
                <FormDescription>
                  Mark as a meeting to add participants and meeting minutes
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        
        {form.watch('is_meeting') && (
          <div className="space-y-4 border rounded-md p-4">
            <div className="flex justify-between">
              <h3 className="text-lg font-medium">Participants</h3>
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant={selectedTab === 'internal' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSelectedTab('internal')}
                >
                  Users
                </Button>
                <Button 
                  type="button" 
                  variant={selectedTab === 'external' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setSelectedTab('external')}
                >
                  Non-Users
                </Button>
              </div>
            </div>
            
            {selectedTab === 'internal' && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="participants"
                  render={() => (
                    <FormItem>
                      <FormDescription>
                        Select users from your organization
                      </FormDescription>
                      
                      <div className="relative my-2">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users by name or email..."
                          className="pl-8"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      
                      <ScrollArea className="h-[300px] rounded-md border">
                        <div className="p-4 space-y-2">
                          {filteredUsers.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No users found
                            </p>
                          )}
                          
                          {filteredUsers.map(user => (
                            <div key={user.id} className="flex items-center justify-between p-2 hover:bg-accent rounded-md">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`participant-${user.id}`}
                                  checked={selectedParticipants.includes(user.id)}
                                  onCheckedChange={() => toggleParticipant(user.id)}
                                  disabled={isSubmitting}
                                />
                                <div>
                                  <label
                                    htmlFor={`participant-${user.id}`}
                                    className="text-sm font-medium cursor-pointer"
                                  >
                                    {user.first_name} {user.last_name}
                                  </label>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      
                      {selectedParticipants.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium">Selected ({selectedParticipants.length}):</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {selectedParticipants.map(id => {
                              const user = users.find(u => u.id === id);
                              if (!user) return null;
                              return (
                                <Badge key={id} variant="secondary" className="flex items-center gap-1">
                                  {user.first_name} {user.last_name}
                                  <button 
                                    type="button" 
                                    onClick={() => toggleParticipant(id)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {selectedTab === 'external' && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="non_user_participants"
                  render={() => (
                    <FormItem>
                      <FormDescription>
                        Add participants who are not registered users
                      </FormDescription>
                      
                      <div className="flex gap-2 my-2">
                        <Input
                          placeholder="Enter participant name..."
                          value={newParticipantName}
                          onChange={(e) => setNewParticipantName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addNonUserParticipant();
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="icon"
                          onClick={addNonUserParticipant}
                          disabled={!newParticipantName}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {nonUserParticipants.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {nonUserParticipants.map(name => (
                            <Badge key={name} variant="secondary" className="flex items-center gap-1">
                              {name}
                              <button 
                                type="button" 
                                onClick={() => removeNonUserParticipant(name)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No non-user participants added
                        </p>
                      )}
                      
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        )}
        
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              {initialData ? 'Updating...' : 'Creating...'}
            </span>
          ) : initialData ? 'Update Event' : 'Create Event'}
        </Button>
      </form>
    </Form>
  );
};

export default EventForm;
