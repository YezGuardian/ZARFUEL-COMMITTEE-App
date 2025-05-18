import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isTomorrow, addDays, isSameMonth, parseISO, isAfter, isBefore, isSameDay } from 'date-fns';
import { CalendarClock, Plus, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Task, Status } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EventForm from '@/components/calendar/EventForm';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { useTasks } from '@/hooks/useTasks';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createNotification, createMeetingNotification } from '@/utils/notificationService';

interface Event {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  is_meeting: boolean;
  location?: string;
  created_by?: string;
}

type CalendarItem = {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  isTask?: boolean;
  isTaskStart?: boolean;
  isTaskEnd?: boolean;
  status?: string;
  taskId?: string;
  location?: string;
  isMeeting?: boolean;
};

const CalendarPage: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [dayEvents, setDayEvents] = useState<CalendarItem[]>([]);
  const [monthItems, setMonthItems] = useState<CalendarItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [monthName, setMonthName] = useState<string>(format(new Date(), 'MMMM yyyy'));
  const [monthNameClicked, setMonthNameClicked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAdmin, user } = useAuth();
  const { tasks } = useTasks();
  
  useEffect(() => {
    fetchEvents();
  }, []);
  
  useEffect(() => {
    // Update items when selectedDate changes
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    setMonthName(format(selectedDate, 'MMMM yyyy'));
    
    // Combine events and tasks for current month
    const combinedItems: CalendarItem[] = [];
    
    // Add events for current month
    events.forEach(event => {
      const startDate = parseISO(event.start_time);
      if (isSameMonth(startDate, selectedDate)) {
        combinedItems.push({
          id: `event-${event.id}`,
          title: event.title,
          description: event.description,
          start_time: event.start_time,
          end_time: event.end_time,
          isMeeting: event.is_meeting,
          location: event.location
        });
      }
    });
    
    // Add tasks with start dates
    tasks.forEach(task => {
      if (task.start_date) {
        const startDate = parseISO(task.start_date);
        if (isSameMonth(startDate, selectedDate)) {
          combinedItems.push({
            id: `task-start-${task.id}`,
            title: `${task.title} (Start)`,
            description: task.description,
            start_time: task.start_date,
            isTask: true,
            isTaskStart: true,
            status: task.status,
            taskId: task.id
          });
        }
      }
      
      // Add tasks with end dates
      if (task.end_date) {
        const endDate = parseISO(task.end_date);
        if (isSameMonth(endDate, selectedDate)) {
          combinedItems.push({
            id: `task-end-${task.id}`,
            title: `${task.title} (End)`,
            description: task.description,
            start_time: task.end_date,
            isTask: true,
            isTaskEnd: true,
            status: task.status,
            taskId: task.id
          });
        }
      }
    });
    
    setMonthItems(combinedItems);
    
    // Set day events for selected date or all month events if month name clicked
    if (monthNameClicked) {
      setDayEvents(combinedItems.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      ));
    } else {
      const selectedDayItems = combinedItems.filter(item => {
        const itemDate = parseISO(item.start_time);
        return isSameDay(itemDate, selectedDate);
      });
      
      setDayEvents(selectedDayItems);
    }
  }, [selectedDate, events, tasks, monthNameClicked]);
  
  const fetchEvents = async () => {
    try {
      if (!user) {
        console.warn('No authenticated user found for fetching events');
        return;
      }
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    }
  };
  
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setMonthNameClicked(false);
    }
  };
  
  const handleCreateEvent = async (eventData: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      
      // Close the dialog immediately to prevent double submissions
      setDialogOpen(false);
      
      // Make sure we set the current user as created_by
      if (user) {
        eventData.created_by = user.id;
      } else {
        throw new Error('User not authenticated. Please log in again.');
      }
      
      // Ensure created_by is set before inserting
      if (!eventData.created_by) {
        throw new Error('User ID is required to create an event');
      }
      
      // Extract participants before sending to Supabase
      const participants = eventData.participants || [];
      delete eventData.participants;
      
      // Clean up any other fields that might cause problems
      if (eventData.non_user_participants) {
        delete eventData.non_user_participants;
      }
      
      let data, error;
      
      try {
        // Try to insert the event
        const result = await supabase
          .from('events')
          .insert([eventData])
          .select()
          .single();
        
        data = result.data;
        error = result.error;
        
        if (error) throw error;
      } catch (insertError: any) {
        // If this is a duplicate key error, try to fetch the recently created event
        if (insertError.message && insertError.message.includes('duplicate key value')) {
          console.log('Handling duplicate event creation');
          
          // Get most recently created event with same title by this user
          const { data: existingEvent, error: fetchError } = await supabase
            .from('events')
            .select('*')
            .eq('title', eventData.title)
            .eq('created_by', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (fetchError) throw insertError; // Rethrow original error if we can't find it
          data = existingEvent;
        } else {
          throw insertError;
        }
      }
      
      console.log('Event created successfully:', data);
      
      // Add participants if it's a meeting and we have participants
      if (data && eventData.is_meeting && participants.length > 0) {
        await addEventParticipants(data.id, participants);
        
        // Send email notifications to participants (if this is a meeting)
        try {
          await sendMeetingInvitations(data.id);
        } catch (emailError) {
          console.error('Error sending email invitations:', emailError);
          // Continue execution even if email sending fails
        }
      }
      
      fetchEvents();
      
      // Handle in-app notifications
      // For regular events, notify all users
      // For meetings, notify only the participants
      if (eventData.is_meeting) {
        // Send notifications to participants if it's a meeting
        if (participants.length > 0) {
          for (const participantId of participants) {
            await createNotification({
              userId: participantId,
              type: 'meeting',
              content: `You have been invited to a meeting: ${eventData.title}`,
              link: '/meetings'
            });
          }
        }
      } else {
        // For regular events, get all users and notify them
        try {
          const { data: allUsers } = await supabase
            .from('profiles')
            .select('id');
            
          if (allUsers && allUsers.length > 0) {
            for (const userProfile of allUsers) {
              // Don't notify the creator about their own event
              if (userProfile.id !== user.id) {
                await createNotification({
                  userId: userProfile.id,
                  type: 'event',
                  content: `New event created: ${eventData.title}`,
                  link: '/calendar'
                });
              }
            }
          }
        } catch (notifyError) {
          console.error('Error notifying users about event:', notifyError);
          // Don't show error to user, just log it
        }
      }
      
      toast.success(eventData.is_meeting ? 'Meeting scheduled successfully' : 'Event created successfully');
      return true;
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error(error.message || 'Failed to create event');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCreateSuccess = async (data: Record<string, any>) => {
    return await handleCreateEvent(data);
  };
  
  // Send email invitations for a meeting
  const sendMeetingInvitations = async (eventId: string) => {
    try {
      // You would typically call a Supabase edge function or other service here
      // This is just a placeholder to show where you would integrate with an email service
      const { error } = await supabase.functions.invoke('send-meeting-invitation', {
        body: { eventId }
      });
      
      if (error) throw error;
      console.log('Meeting invitations sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending meeting invitations:', error);
      return false;
    }
  };
  
  // Add participants to an event
  const addEventParticipants = async (eventId: string, participantIds: string[]) => {
    if (!participantIds || participantIds.length === 0) {
      console.log('No participants to add');
      return true;
    }
    
    try {
      console.log(`Adding ${participantIds.length} participants to event ${eventId}`);
      
      // First, check if any participants already exist to avoid duplicates
      const { data: existingParticipants, error: checkError } = await supabase
        .from('event_participants')
        .select('user_id')
        .eq('event_id', eventId);
        
      if (checkError) {
        console.error('Error checking existing participants:', checkError);
      }
      
      // Filter out existing participants
      const existingUserIds = new Set((existingParticipants || []).map(p => p.user_id));
      const newParticipantIds = participantIds.filter(id => !existingUserIds.has(id));
      
      if (newParticipantIds.length === 0) {
        console.log('All participants already added');
        return true;
      }
      
      // Create participant records
      const participants = newParticipantIds.map(userId => ({
        event_id: eventId,
        user_id: userId,
        response: 'pending'
      }));
      
      const { data, error } = await supabase
        .from('event_participants')
        .insert(participants);
        
      if (error) {
        console.error('Error adding participants:', error);
        toast.error('Event was created but failed to add some participants');
        return false;
      }
      
      console.log(`Successfully added ${newParticipantIds.length} participants`);
      return true;
    } catch (error) {
      console.error('Error adding participants:', error);
      toast.error('Event was created but failed to add participants');
      return false;
    }
  };
  
  const getDaysWithEvents = () => {
    const daysWithEvents = new Set<string>();
    
    // Add event days
    events.forEach(event => {
      daysWithEvents.add(format(parseISO(event.start_time), 'yyyy-MM-dd'));
    });
    
    // Add task start dates
    tasks.forEach(task => {
      if (task.start_date) {
        daysWithEvents.add(format(parseISO(task.start_date), 'yyyy-MM-dd'));
      }
    });
    
    // Add task end dates
    tasks.forEach(task => {
      if (task.end_date) {
        daysWithEvents.add(format(parseISO(task.end_date), 'yyyy-MM-dd'));
      }
    });
    
    return daysWithEvents;
  };
  
  // Get upcoming events and tasks
  const getUpcomingItems = () => {
    const now = new Date();
    const upcomingItems: CalendarItem[] = [];
    
    // Add upcoming events
    events.forEach(event => {
      const startDate = parseISO(event.start_time);
      if (isAfter(startDate, now)) {
        upcomingItems.push({
          id: `event-${event.id}`,
          title: event.title,
          description: event.description,
          start_time: event.start_time,
          end_time: event.end_time,
          isMeeting: event.is_meeting,
          location: event.location
        });
      }
    });
    
    // Add upcoming task start dates
    tasks.forEach(task => {
      if (task.start_date) {
        const startDate = parseISO(task.start_date);
        if (isAfter(startDate, now)) {
          upcomingItems.push({
            id: `task-start-${task.id}`,
            title: `${task.title} (Start)`,
            description: task.description,
            start_time: task.start_date,
            isTask: true,
            isTaskStart: true,
            status: task.status,
            taskId: task.id
          });
        }
      }
    });
    
    // Add upcoming task end dates
    tasks.forEach(task => {
      if (task.end_date) {
        const endDate = parseISO(task.end_date);
        if (isAfter(endDate, now)) {
          upcomingItems.push({
            id: `task-end-${task.id}`,
            title: `${task.title} (End)`,
            description: task.description,
            start_time: task.end_date,
            isTask: true,
            isTaskEnd: true,
            status: task.status,
            taskId: task.id
          });
        }
      }
    });
    
    // Sort by date (ascending)
    return upcomingItems.sort((a, b) => 
      parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime()
    ).slice(0, 5); // Limit to 5 items
  };
  
  const handleMonthNameClick = () => {
    setMonthNameClicked(true);
  };
  
  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!currentEvent) return;
    
    try {
      // Log deletion before actual delete
      await supabase.from('deletion_logs').insert({
        table_name: 'events',
        record_id: currentEvent.id,
        deleted_by: user?.id || '',
        deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
        details: currentEvent,
      });

      // Send notifications to admin, special users, and superadmins using the notification service
      await createMeetingNotification({
        meetingId: currentEvent.id,
        meetingTitle: currentEvent.title,
        action: 'deleted',
        performedBy: user?.user_metadata?.full_name || user?.email || '',
        excludeUserId: user?.id // Exclude the user who performed the deletion
      });

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', currentEvent.id);
        
      if (error) throw error;
      
      setEvents(events.filter(e => e.id !== currentEvent.id));
      toast.success('Event deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  // Extract event ID from CalendarItem
  const getEventIdFromItem = (item: CalendarItem): string | null => {
    if (!item.id.startsWith('event-')) return null;
    return item.id.replace('event-', '');
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            View and manage meetings, events, and task deadlines
          </p>
        </div>
        
        {isAdmin() && (
          <Button 
            className="bg-zarfuel-blue hover:bg-zarfuel-blue/90"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1">
                <div 
                  className="text-lg font-medium mb-2 text-center cursor-pointer hover:underline" 
                  onClick={handleMonthNameClick}
                >
                  {monthName}
                </div>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  className="rounded-md border pointer-events-auto"
                  modifiers={{
                    eventDay: (date) => 
                      getDaysWithEvents().has(format(date, 'yyyy-MM-dd')),
                    today: (date) => isToday(date),
                  }}
                  modifiersClassNames={{
                    eventDay: "bg-blue-100 text-blue-900 relative before:absolute before:bottom-1 before:left-1/2 before:-translate-x-1/2 before:h-1 before:w-1 before:bg-primary before:rounded-full",
                    today: "bg-primary text-primary-foreground font-bold",
                  }}
                />
              </div>
              
              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-lg font-medium">
                    {selectedItem ? "Item Details" : monthNameClicked 
                      ? `All Items for ${monthName}` 
                      : `Calendar Items for ${format(selectedDate, 'PPP')}`}
                  </h3>
                </div>
                
                <ScrollArea className="h-[300px]">
                  {selectedItem ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-lg">{selectedItem.title}</h4>
                          {isAdmin() && !selectedItem.isTask && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => {
                                    const eventId = getEventIdFromItem(selectedItem);
                                    if (eventId) {
                                      const event = events.find(e => e.id === eventId);
                                      if (event) {
                                        setCurrentEvent(event);
                                        setEditDialogOpen(true);
                                      }
                                    }
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    const eventId = getEventIdFromItem(selectedItem);
                                    if (eventId) {
                                      const event = events.find(e => e.id === eventId);
                                      if (event) {
                                        setCurrentEvent(event);
                                        setDeleteDialogOpen(true);
                                      }
                                    }
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {selectedItem.isTask && (
                          <StatusBadge status={selectedItem.status as Status || 'notstarted'} />
                        )}
                        {selectedItem.isMeeting && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Meeting
                          </div>
                        )}
                        {selectedItem.isTaskStart && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Starting Date
                          </div>
                        )}
                        {selectedItem.isTaskEnd && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Ending Date
                          </div>
                        )}
                      </div>
                      
                      {selectedItem.description && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground font-medium">Description:</p>
                          <p className="text-sm">{selectedItem.description}</p>
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground font-medium">Date:</p>
                        <p className="text-sm">{format(parseISO(selectedItem.start_time), 'PPP')}</p>
                      </div>
                      
                      {selectedItem.end_time && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground font-medium">Time:</p>
                          <p className="text-sm">
                            {format(parseISO(selectedItem.start_time), 'p')} - {format(parseISO(selectedItem.end_time), 'p')}
                          </p>
                        </div>
                      )}
                      
                      {selectedItem.location && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground font-medium">Location:</p>
                          <p className="text-sm">{selectedItem.location}</p>
                        </div>
                      )}
                      
                      <div className="pt-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedItem(null)}>
                          Back to List
                        </Button>
                      </div>
                    </div>
                  ) : dayEvents.length > 0 ? (
                    <div className="space-y-2">
                      {dayEvents.map(item => (
                        <div 
                          key={item.id} 
                          className={`p-3 border rounded-md cursor-pointer hover:border-primary ${
                            item.isTaskStart ? 'border-yellow-300 border-l-4' : 
                            item.isTaskEnd ? 'border-purple-400 border-l-4' : ''
                          }`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="flex justify-between">
                            <div className="font-medium">{item.title}</div>
                            {item.isTask ? (
                              <StatusBadge status={item.status as Status || 'notstarted'} />
                            ) : (
                              <div className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                {item.isMeeting ? 'Meeting' : 'Event'}
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {format(parseISO(item.start_time), 'p')}
                            {item.end_time && ` - ${format(parseISO(item.end_time), 'p')}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : monthItems.length > 0 ? (
                    <div className="text-center p-4">
                      <p className="text-muted-foreground">
                        No items scheduled for {format(selectedDate, 'PPP')}
                      </p>
                      <p className="text-sm mt-2">
                        Select a day with events or click on the month name to view all events
                      </p>
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-muted-foreground">
                        No events or deadlines this month
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Upcoming Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center">
              <CalendarClock className="mr-2 h-5 w-5" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {getUpcomingItems().length > 0 ? (
                  getUpcomingItems().map((item, index) => (
                    <div key={item.id}>
                      {index > 0 && <Separator className="my-2" />}
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.title}</span>
                          {item.isTask ? (
                            <StatusBadge status={item.status as Status || 'notstarted'} />
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                              {item.isMeeting ? 'Meeting' : 'Event'}
                            </span>
                          )}
                        </div>
                        {item.isTaskStart && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Starting Date
                          </div>
                        )}
                        {item.isTaskEnd && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Ending Date
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {format(parseISO(item.start_time), 'PPP')}
                        </div>
                        {item.end_time && (
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(item.start_time), 'p')} - {format(parseISO(item.end_time), 'p')}
                          </div>
                        )}
                        {item.location && (
                          <div className="text-xs text-muted-foreground">
                            Location: {item.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center p-4">
                    <CalendarClock className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No upcoming events or deadlines
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        // Only allow closing if not submitting
        if (!isSubmitting) {
          setDialogOpen(open);
        }
      }}>
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-visible">
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)] overflow-y-auto">
            <EventForm onSuccess={handleCreateSuccess} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Edit Event Dialog */}
      {currentEvent && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-visible">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(85vh-120px)] overflow-y-auto">
              <EventForm 
                onSuccess={() => {
                  // The event is already updated in the EventForm component
                  fetchEvents();
                  setEditDialogOpen(false);
                  setSelectedItem(null);
                  toast.success('Event updated successfully');
                }}
                initialData={{
                  ...currentEvent,
                  start_date: parseISO(currentEvent.start_time),
                  start_time: format(parseISO(currentEvent.start_time), 'HH:mm'),
                  end_date: parseISO(currentEvent.end_time),
                  end_time: format(parseISO(currentEvent.end_time), 'HH:mm'),
                }}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Delete Event Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CalendarPage;
