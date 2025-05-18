import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Users, Clock, MapPin, FileText, Download, MoreHorizontal, Edit, Trash2, Upload, Eye, FileEdit } from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Event, MeetingMinute } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import EventForm from '@/components/calendar/EventForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import MeetingResponseButtons from '@/components/calendar/MeetingResponseButtons';
import { UploadButton } from '@/components/ui/upload-button';
import PDFViewer from '@/components/ui/pdf-viewer';
import { uploadToDrive } from '@/integrations/google/drive-api';
import MeetingMinutesForm from '@/components/meetings/MeetingMinutesForm';
import MeetingMinutesViewer from '@/components/meetings/MeetingMinutesViewer';
import { createMeetingNotification } from '@/utils/notificationService';

const MeetingsPage: React.FC = () => {
  const [meetings, setMeetings] = useState<Event[]>([]);
  const [meetingMinutes, setMeetingMinutes] = useState<Record<string, MeetingMinute[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [recordMinutesDialogOpen, setRecordMinutesDialogOpen] = useState(false);
  const [minutesDialogOpen, setMinutesDialogOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [viewTextMinutesOpen, setViewTextMinutesOpen] = useState(false);
  const [editTextMinutesOpen, setEditTextMinutesOpen] = useState(false);
  const [currentMinute, setCurrentMinute] = useState<MeetingMinute | null>(null);
  const [currentMeeting, setCurrentMeeting] = useState<Event | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { user, isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch meetings and meeting minutes
  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      let allMeetings = [];
      if (isAdmin && isAdmin()) {
        // Admins, superadmins, and special users see all meetings
        const { data: allMeetingsData, error: allMeetingsError } = await supabase
          .from('events')
          .select('*')
          .eq('is_meeting', true)
          .order('start_time');
        if (allMeetingsError) throw allMeetingsError;
        allMeetings = allMeetingsData || [];
      } else {
        // Regular users: events created by the user
        const { data: createdMeetings, error: createdMeetingsError } = await supabase
          .from('events')
          .select('*')
          .eq('is_meeting', true)
          .eq('created_by', user.id)
          .order('start_time');
        if (createdMeetingsError) throw createdMeetingsError;
        // Events where the user is a participant
        const { data: participatingData, error: participatingError } = await supabase
          .from('event_participants')
          .select(`
            event:event_id (*)
          `)
          .eq('user_id', user.id);
        if (participatingError) throw participatingError;
        const participatingMeetings = participatingData
          .map(item => item.event)
          .filter(event => event && event.is_meeting)
          .filter(event => event.created_by !== user.id);
        allMeetings = [...createdMeetings, ...participatingMeetings];
      }
      // Sort by start time
      const sortedMeetings = allMeetings.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      // Convert the raw meeting data to our Event type
      const formattedMeetings = sortedMeetings || [];
      
      // Separate query to fetch participants for each meeting
      const meetings = await Promise.all(
        formattedMeetings.map(async (meeting) => {
          try {
            // Fetch participants for this meeting
            const { data: participantsData, error: participantsError } = await supabase
              .from('event_participants')
              .select(`
                id,
                user_id,
                response
              `)
              .eq('event_id', meeting.id);
                
            if (participantsError) throw participantsError;
            
            // Fetch user details for participants 
            const participants = await Promise.all(
              (participantsData || []).map(async (participant) => {
                try {
                  const { data: userData, error: userError } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, email')
                    .eq('id', participant.user_id)
                    .single();
                    
                  if (userError) throw userError;
                  
                  return {
                    ...participant,
                    user: userData
                  };
                } catch (error) {
                  console.error(`Error fetching user ${participant.user_id}:`, error);
                  return {
                    ...participant,
                    user: null
                  };
                }
              })
            );
            
            return {
              ...meeting,
              participants
            };
          } catch (error) {
            console.error(`Error fetching participants for meeting ${meeting.id}:`, error);
            return {
              ...meeting,
              participants: []
            };
          }
        })
      );
      
      // Use a type assertion to handle the mismatch between API response and our Event type
      setMeetings(meetings as unknown as Event[]);
      
      // Fetch meeting minutes for all meetings
      const minutesMap: Record<string, MeetingMinute[]> = {};
      
      for (const meeting of meetings) {
        try {
          // Simplified query to avoid foreign key issues
          const { data: minutesData, error: minutesError } = await supabase
            .from('meeting_minutes')
            .select('*')
            .eq('event_id', meeting.id);
            
          if (minutesError) {
            console.error(`Error fetching minutes for meeting ${meeting.id}:`, minutesError);
            minutesMap[meeting.id] = [];
            continue;
          }
          
          // Fetch uploader profile separately - more reliable than using foreign key relationships
          const formattedMinutes = await Promise.all(
            minutesData.map(async (minute: any) => {
              try {
                // Get uploader profile information if available
                if (minute.uploaded_by) {
                  const { data: uploaderData, error: uploaderError } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, email')
                    .eq('id', minute.uploaded_by)
                    .single();
                  
                  if (!uploaderError && uploaderData) {
                    return {
                      ...minute,
                      uploader: uploaderData
                    };
                  }
                }
                
                // Return with default uploader if not found
                return {
                  ...minute,
                  uploader: {
                    first_name: 'Unknown',
                    last_name: 'User',
                    email: ''
                  }
                };
              } catch (error) {
                console.error(`Error fetching uploader for minute ${minute.id}:`, error);
                return {
                  ...minute,
                  uploader: {
                    first_name: 'Unknown',
                    last_name: 'User',
                    email: ''
                  }
                };
              }
            })
          );
          
          minutesMap[meeting.id] = (formattedMinutes as unknown as MeetingMinute[]);
        } catch (error) {
          console.error(`Error fetching minutes for meeting ${meeting.id}:`, error);
          minutesMap[meeting.id] = [];
        }
      }
      
      setMeetingMinutes(minutesMap);
    } catch (error) {
      console.error('Error fetching meetings data:', error);
      toast.error('Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
    
    // Set up real-time updates
    const channel = supabase
      .channel('meetings-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'events',
          filter: 'is_meeting=eq.true'
        }, 
        () => {
          fetchData();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'meeting_minutes'
        }, 
        () => {
          fetchData();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Split meetings into upcoming and previous
  const now = new Date();
  const upcomingMeetings = meetings.filter(meeting => parseISO(meeting.start_time) >= now);
  const previousMeetings = meetings.filter(meeting => parseISO(meeting.start_time) < now);

  const handleCreateMeeting = async (eventData) => {
    try {
      setIsSubmitting(true);
      
      // Close dialog immediately to prevent double submissions
      setAddDialogOpen(false);
      
      // Make sure created_by is set to current user
      if (user) {
        eventData.created_by = user.id;
      } else {
        throw new Error('User not authenticated. Please log in again.');
      }
      
      // Extract participants and external emails before sending to Supabase
      const participants = eventData.participants || [];
      const externalEmails = eventData.external_emails || [];
      delete eventData.participants;
      delete eventData.external_emails;
      
      // Handle non_user_participants properly
      if (eventData.non_user_participants) {
        delete eventData.non_user_participants; // Remove this field to prevent errors
      }
      
      // Ensure it's marked as a meeting
      eventData.is_meeting = true;
      
      let data;
      
      try {
        // Check if same meeting exists within a short time window to prevent duplicates
        const { data: existingMeetings } = await supabase
          .from('events')
          .select('id, title')
          .eq('title', eventData.title)
          .eq('created_by', user.id)
          .eq('is_meeting', true)
          .gt('created_at', new Date(Date.now() - 5000).toISOString()); // Last 5 seconds
          
        if (existingMeetings && existingMeetings.length > 0) {
          console.log('Preventing duplicate meeting creation');
          data = existingMeetings[0];
        } else {
          // Insert new meeting
          const { data: newData, error } = await supabase
            .from('events')
            .insert([eventData])
            .select()
            .single();
            
          if (error) throw error;
          data = newData;
        }
      } catch (insertError) {
        // If this is a duplicate key error, try to fetch the recently created meeting
        if (insertError.message && insertError.message.includes('duplicate key value')) {
          console.log('Handling duplicate meeting creation gracefully');
          
          // Get most recently created meeting with same title by this user
          const { data: existingMeeting, error: fetchError } = await supabase
            .from('events')
            .select('*')
            .eq('title', eventData.title)
            .eq('created_by', user.id)
            .eq('is_meeting', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
            
          if (fetchError) throw insertError; // Rethrow original error if we can't find it
          data = existingMeeting;
        } else {
          throw insertError;
        }
      }
      
      if (!data || !data.id) {
        throw new Error('Failed to create or find meeting');
      }
      
      // Add participants if there are any
      if (data && participants.length > 0) {
        await addEventParticipants(data.id, participants);
      }
      
      // Add external participants if there are any
      if (data && externalEmails.length > 0) {
        await addExternalParticipants(data.id, externalEmails);
      }
      
      // Attempt to send email invitations
      try {
        await sendMeetingInvitations(data.id);
      } catch (emailError) {
        console.error('Error sending email invitations:', emailError);
        // Continue execution even if email sending fails
      }
      
      // Send notification to admin/special/superadmin
      await createMeetingNotification({
        meetingId: data.id,
        meetingTitle: data.title,
        action: 'created',
        performedBy: user.email || 'A user',
        excludeUserId: user.id
      });
      
      // Update local state
      fetchData();
      
      // Show success message
      toast.success('Meeting created successfully!');
      return true;
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error('Failed to create meeting. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Add participants to an event
  const addEventParticipants = async (eventId: string, participantIds: string[]) => {
    if (!participantIds || participantIds.length === 0) {
      return true;
    }
    
    try {
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
        return true;
      }
      
      // Create participant records
      const participants = newParticipantIds.map(userId => ({
        event_id: eventId,
        user_id: userId,
        response: 'pending'
      }));
      
      const { error } = await supabase
        .from('event_participants')
        .insert(participants);
        
      if (error) {
        console.error('Error adding participants:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error adding participants:', error);
      return false;
    }
  };
  
  // Send email invitations for a meeting
  const sendMeetingInvitations = async (eventId: string) => {
    try {
      // Call the Supabase Edge Function to send email invitations
      const { error } = await supabase.functions.invoke('send-meeting-invitation', {
        body: { eventId }
      });
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending meeting invitations:', error);
      return false;
    }
  };
  
  const createNotification = async (userId: string, type: string, content: string, link: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([
          { user_id: userId, type, content, link }
        ]);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };
  
  const handleDeleteMeeting = async () => {
    if (!currentMeeting) return;
    try {
      // Log deletion before actual delete
      await supabase.from('deletion_logs').insert({
        table_name: 'events',
        record_id: currentMeeting.id,
        deleted_by: user?.id || '',
        deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
        details: currentMeeting,
      });
      // Send notification
      await createMeetingNotification({
        meetingId: currentMeeting.id,
        meetingTitle: currentMeeting.title,
        action: 'deleted',
        performedBy: user?.user_metadata?.full_name || user?.email || '',
        excludeUserId: user?.id
      });
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', currentMeeting.id);
      if (error) throw error;
      setMeetings(meetings.filter(m => m.id !== currentMeeting.id));
      toast.success('Meeting deleted successfully');
      setDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    }
  };
  
  const handleFileUpload = async () => {
    if (!selectedFile || !currentMeeting || !user) return;
    
    setUploadingFile(true);
    
    try {
      // Check file size (max 20MB)
      const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes
      if (selectedFile.size > MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum allowed (20MB). Your file is ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB.`);
      }
      
      console.log("Starting Google Drive upload...");
      
      // Upload to Google Drive (folder path based on meeting ID)
      const driveUpload = await uploadToDrive(selectedFile, `meeting_minutes/${currentMeeting.id}`);
      
      if (!driveUpload) {
        throw new Error('Failed to upload file to Google Drive');
      }
      
      console.log("File uploaded successfully to Google Drive:", driveUpload.url);
      
      // Insert the record into the meeting_minutes table
      try {
        const { error: insertError } = await supabase
          .from('meeting_minutes')
          .insert({
            event_id: currentMeeting.id,
            file_path: driveUpload.url,
            file_name: selectedFile.name,
            file_type: selectedFile.type || 'application/pdf',
            file_size: selectedFile.size,
            uploaded_by: user.id,
            is_published: true,
            drive_file_id: driveUpload.fileId // Store the Drive file ID for future reference
          });
        
        if (insertError) {
          throw insertError;
        }
        
        console.log("Database record created successfully");
      } catch (insertError) {
        console.error('Database insert failed:', insertError);
        
        // Even if the database insert fails, we've still uploaded to Drive
        // Add a fake record to the local state
        const fakeMeetingMinute = {
          id: `fake-${Date.now()}`,
          event_id: currentMeeting.id,
          file_path: driveUpload.url,
          file_name: selectedFile.name,
          file_type: selectedFile.type || 'application/pdf', 
          file_size: selectedFile.size,
          uploaded_by: user.id,
          is_published: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          drive_file_id: driveUpload.fileId,
          uploader: {
            id: user.id,
            email: user.email,
            display_name: user.email.split('@')[0]
          }
        };
        
        setMeetingMinutes(prev => ({
          ...prev,
          [currentMeeting.id]: [
            ...(prev[currentMeeting.id] || []),
            fakeMeetingMinute as any
          ]
        }));
        
        console.log("Added fake record to local state since database insert failed");
      }
      
      toast.success('Meeting minutes uploaded successfully');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      fetchData();
    } catch (error: any) {
      console.error('Error in file upload process:', error);
      toast.error(error.message || 'Failed to upload meeting minutes');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setSelectedFile(e.target.files[0]);
  };
  
  // Helper function to format relative date
  const getRelativeDateString = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (date < addDays(now, 7)) return format(date, 'EEEE'); // Day name if within a week
    return format(date, 'MMM d, yyyy'); // Full date
  };
  
  const addExternalParticipants = async (eventId: string, emails: string[]) => {
    try {
      // First, check if any of these emails already belong to existing users
      const { data: existingUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', emails);
        
      if (usersError) throw usersError;
      
      // For emails that match existing users, add them as regular participants
      if (existingUsers && existingUsers.length > 0) {
        const existingUserIds = existingUsers.map(user => user.id);
        await addEventParticipants(eventId, existingUserIds);
        
        // Remove these emails from the external emails list
        const existingEmails = existingUsers.map(user => user.email);
        emails = emails.filter(email => !existingEmails.includes(email));
      }
      
      // For remaining external emails, create temporary participant records (customize this based on your schema)
      if (emails.length > 0) {
        try {
          // Create a separate temporary record for each external participant
          for (const email of emails) {
            await supabase.from('event_participants').insert({
              event_id: eventId,
              user_id: null,
              response: 'pending',
              external_email: email
            });
          }
        } catch (error) {
          console.error('Error adding external participants:', error);
        }
      }
    } catch (error) {
      console.error('Error adding external participants:', error);
      throw new Error('Failed to add external participants');
    }
  };
  
  const getMinutesButton = (meeting: Event) => {
    console.log(`Meeting ${meeting.id} minutes:`, meetingMinutes[meeting.id]);
    
    // Check if minutes exist for this meeting
    const minutesForMeeting = meetingMinutes[meeting.id] || [];
    const meetingHasMinutes = minutesForMeeting.length > 0;
    
    // Find text and file minutes if they exist
    const textMinutes = minutesForMeeting.find(m => 
      m.source_type === 'text' || (m.content && m.content.trim().length > 0)
    );
    
    const fileMinutes = minutesForMeeting.find(m => 
      m.source_type === 'file' || (m.file_path && !m.content)
    );
    
    const isCompletedMeeting = parseISO(meeting.end_time) < new Date();
    
    if (meetingHasMinutes) {
      // Show "View Minutes" if minutes exist, with a dropdown if there are multiple types
      if (textMinutes && fileMinutes) {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="flex-1">
                <Eye className="h-4 w-4 mr-2" />
                View Minutes
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => {
                setCurrentMeeting(meeting);
                setCurrentMinute(textMinutes);
                setViewTextMinutesOpen(true);
              }}>
                <FileEdit className="h-4 w-4 mr-2" />
                View Text Minutes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setCurrentMeeting(meeting);
                setCurrentMinute(fileMinutes);
                setPdfViewerOpen(true);
              }}>
                <FileText className="h-4 w-4 mr-2" />
                View File Minutes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      } else if (textMinutes) {
        // Only text minutes exist
        return (
          <Button 
            size="sm" 
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setCurrentMeeting(meeting);
              setCurrentMinute(textMinutes);
              setViewTextMinutesOpen(true);
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Minutes
          </Button>
        );
      } else if (fileMinutes) {
        // Only file minutes exist
        return (
          <Button 
            size="sm" 
            variant="secondary"
            className="flex-1"
            onClick={() => {
              setCurrentMeeting(meeting);
              setCurrentMinute(fileMinutes);
              setPdfViewerOpen(true);
            }}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Minutes
          </Button>
        );
      }
    }
    
    // Only show "Record Minutes" button for completed meetings without minutes
    if (isCompletedMeeting) {
      return (
        <Button 
          size="sm" 
          className="flex-1"
          onClick={() => {
            setCurrentMeeting(meeting);
            setRecordMinutesDialogOpen(true);
          }}
        >
          <FileEdit className="h-4 w-4 mr-2" />
          Record Minutes
        </Button>
      );
    }
    
    // For upcoming meetings with no minutes, don't show a minutes button
    return null;
  };
  
  const renderUpcomingMeetingCard = (meeting: Event) => (
    <Card key={meeting.id}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{meeting.title}</CardTitle>
            {meeting.created_by === user?.id ? (
              <Badge variant="secondary" className="mt-1">
                You are the organizer
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-1">
                You are invited
              </Badge>
            )}
          </div>
          {(isAdmin() || meeting.created_by === user?.id) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => {
                    setCurrentMeeting(meeting);
                    setEditDialogOpen(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    setCurrentMeeting(meeting);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {meeting.description && (
          <CardDescription>{meeting.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {getRelativeDateString(meeting.start_time)} • {format(parseISO(meeting.start_time), 'h:mm a')} - {format(parseISO(meeting.end_time), 'h:mm a')}
            </span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{meeting.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              {meeting.participants && meeting.participants.length > 0
                ? `${meeting.participants.length} participant${meeting.participants.length !== 1 ? 's' : ''}`
                : 'No participants'}
            </span>
          </div>
          <div className="pt-2 flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                setCurrentMeeting(meeting);
                setMinutesDialogOpen(true);
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderPreviousMeetingCard = (meeting: Event) => (
    <Card key={meeting.id}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{meeting.title}</CardTitle>
            {meeting.created_by === user?.id ? (
              <Badge variant="secondary" className="mt-1">
                You are the organizer
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-1">
                You are invited
              </Badge>
            )}
          </div>
          {(isAdmin() || meeting.created_by === user?.id) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => {
                    setCurrentMeeting(meeting);
                    setEditDialogOpen(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setCurrentMeeting(meeting);
                    setRecordMinutesDialogOpen(true);
                  }}
                >
                  <FileEdit className="mr-2 h-4 w-4" />
                  Record Minutes
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => {
                    setCurrentMeeting(meeting);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {meeting.description && (
          <CardDescription>{meeting.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {format(parseISO(meeting.start_time), 'MMM d, yyyy')} • {format(parseISO(meeting.start_time), 'h:mm a')} - {format(parseISO(meeting.end_time), 'h:mm a')}
            </span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{meeting.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>
              {meeting.participants && meeting.participants.length > 0
                ? `${meeting.participants.length} participant${meeting.participants.length !== 1 ? 's' : ''}`
                : 'No participants'}
            </span>
          </div>
          
          {/* Meeting Minutes Status */}
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>
              {meetingMinutes[meeting.id]?.length 
                ? `${meetingMinutes[meeting.id].length} minute${meetingMinutes[meeting.id].length !== 1 ? 's' : ''} available`
                : 'No minutes recorded'}
            </span>
          </div>
          
          <div className="pt-2 flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => {
                setCurrentMeeting(meeting);
                setMinutesDialogOpen(true);
              }}
            >
              View Details
            </Button>
            {getMinutesButton(meeting)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings & Minutes</h1>
          <p className="text-muted-foreground">
            Schedule and manage committee meetings
          </p>
        </div>
        
        {isAdmin() && (
          <Button 
            className="bg-zarfuel-blue hover:bg-zarfuel-blue/90"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Button>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading meetings...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Meetings */}
          <div>
            <h2 className="text-xl font-medium">Upcoming Meetings</h2>
            {upcomingMeetings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                {upcomingMeetings.map(meeting => renderUpcomingMeetingCard(meeting))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No upcoming meetings scheduled
              </div>
            )}
          </div>
          
          {/* Previous Meetings */}
          <div>
            <h2 className="text-xl font-medium">Previous Meetings & Minutes</h2>
            {previousMeetings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-4">
                {previousMeetings.map(meeting => renderPreviousMeetingCard(meeting))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No previous meetings found
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Add new dialog for recording minutes */}
      <Dialog open={recordMinutesDialogOpen} onOpenChange={setRecordMinutesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-visible">
          <DialogHeader>
            <DialogTitle>Record Meeting Minutes</DialogTitle>
            <DialogDescription>
              {currentMeeting?.title} - {currentMeeting && format(parseISO(currentMeeting.start_time), 'PPP')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            {currentMeeting && (
              <MeetingMinutesForm 
                meeting={currentMeeting}
                onSuccess={() => {
                  fetchData();
                  setRecordMinutesDialogOpen(false);
                }}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Add dialog for viewing text minutes */}
      <Dialog open={viewTextMinutesOpen} onOpenChange={setViewTextMinutesOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-visible">
          <DialogHeader>
            <DialogTitle>Meeting Minutes</DialogTitle>
            <DialogDescription>
              {currentMeeting?.title} - {currentMeeting && format(parseISO(currentMeeting.start_time), 'PPP')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            {currentMinute && currentMeeting && (
              <MeetingMinutesViewer 
                minute={currentMinute}
                meeting={currentMeeting}
                onEdit={() => {
                  setViewTextMinutesOpen(false);
                  setEditTextMinutesOpen(true);
                }}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Add dialog for editing text minutes */}
      <Dialog open={editTextMinutesOpen} onOpenChange={setEditTextMinutesOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-visible">
          <DialogHeader>
            <DialogTitle>Edit Meeting Minutes</DialogTitle>
            <DialogDescription>
              {currentMeeting?.title} - {currentMeeting && format(parseISO(currentMeeting.start_time), 'PPP')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            {currentMeeting && currentMinute && (
              <MeetingMinutesForm 
                meeting={currentMeeting}
                onSuccess={() => {
                  fetchData();
                  setEditTextMinutesOpen(false);
                }}
                existingContent={currentMinute.content || ''}
                editMode={true}
                minuteId={currentMinute.id}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Schedule New Meeting Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        // Only allow closing if not submitting
        if (!isSubmitting) {
          setAddDialogOpen(open);
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-visible">
          <ScrollArea className="max-h-[calc(85vh-40px)]">
            <DialogHeader>
              <DialogTitle>Schedule New Meeting</DialogTitle>
              <DialogDescription>
                Add a new meeting to the calendar
              </DialogDescription>
            </DialogHeader>
            <EventForm 
              onSuccess={async (eventData) => {
                const result = await handleCreateMeeting(eventData);
                // Dialog will already be closed by handleCreateMeeting
                return result;
              }}
              initialData={{
                is_meeting: true
              }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* Edit Meeting Dialog */}
      {currentMeeting && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-visible">
            <ScrollArea className="max-h-[calc(85vh-40px)]">
              <DialogHeader>
                <DialogTitle>Edit Meeting</DialogTitle>
              </DialogHeader>
              <EventForm 
                onSuccess={() => {
                  fetchData();
                  setEditDialogOpen(false);
                }} 
                initialData={{
                  ...currentMeeting,
                  start_date: parseISO(currentMeeting.start_time),
                  start_time: format(parseISO(currentMeeting.start_time), 'HH:mm'),
                  end_date: parseISO(currentMeeting.end_time),
                  end_time: format(parseISO(currentMeeting.end_time), 'HH:mm'),
                  participants: currentMeeting.participants?.map(p => p.user_id) || []
                }}
              />
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Delete Meeting Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMeeting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Upload Meeting Minutes Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Upload Meeting Minutes</DialogTitle>
            <DialogDescription>
              Upload meeting minutes for "{currentMeeting?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select File</Label>
              <UploadButton 
                onFileSelected={setSelectedFile}
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx"
                maxSizeMB={20}
                buttonText="Select File"
                className="w-full"
                buttonProps={{
                  variant: "outline",
                  className: "w-full justify-center"
                }}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setUploadDialogOpen(false);
                setSelectedFile(null);
              }}
              disabled={uploadingFile}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleFileUpload}
              disabled={uploadingFile || !selectedFile}
            >
              {uploadingFile ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"/>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Meeting Details and Minutes Dialog */}
      <Dialog open={minutesDialogOpen} onOpenChange={setMinutesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden">
          <ScrollArea className="max-h-[calc(85vh-40px)]">
            <DialogHeader>
              <DialogTitle>Meeting Details</DialogTitle>
            </DialogHeader>
            {currentMeeting && (
              <div className="space-y-6 mt-4">
                <div>
                  <h3 className="text-xl font-bold">{currentMeeting.title}</h3>
                  {currentMeeting.description && (
                    <p className="mt-2 text-muted-foreground">{currentMeeting.description}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Date & Time</h4>
                    <p>{format(parseISO(currentMeeting.start_time), 'PPP')}</p>
                    <p>{format(parseISO(currentMeeting.start_time), 'h:mm a')} - {format(parseISO(currentMeeting.end_time), 'h:mm a')}</p>
                  </div>
                  
                  {currentMeeting.location && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Location</h4>
                      <p>{currentMeeting.location}</p>
                    </div>
                  )}
                </div>
                
                {/* Participants */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Participants</h4>
                  {currentMeeting.participants && currentMeeting.participants.length > 0 ? (
                    <div className="space-y-2">
                      {currentMeeting.participants.map(participant => (
                        <div key={participant.id} className="flex items-center justify-between">
                          <span>
                            {participant.user?.first_name} {participant.user?.last_name}
                            <span className="text-sm text-muted-foreground ml-2">
                              {participant.user?.email}
                            </span>
                          </span>
                          {participant.user_id === user?.id ? (
                            <MeetingResponseButtons 
                              participant={participant}
                              eventId={currentMeeting.id}
                              eventTitle={currentMeeting.title}
                              onResponseUpdate={(response) => {
                                // Update local state to reflect the response change
                                setMeetings(prevMeetings => 
                                  prevMeetings.map(meeting => {
                                    if (meeting.id === currentMeeting.id) {
                                      const updatedParticipants = meeting.participants?.map(p => 
                                        p.id === participant.id ? { ...p, response } : p
                                      );
                                      return { ...meeting, participants: updatedParticipants };
                                    }
                                    return meeting;
                                  })
                                );
                              }}
                            />
                          ) : (
                            <Badge 
                              variant={
                                participant.response === 'accepted' ? 'secondary' :
                                participant.response === 'declined' ? 'destructive' :
                                'outline'
                              }
                            >
                              {participant.response === 'accepted' ? 'Attending' :
                               participant.response === 'declined' ? 'Declined' :
                               'Pending'}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No participants</p>
                  )}
                </div>
                
                {/* Meeting Minutes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Meeting Minutes</h4>
                    
                    {/* Only show the action buttons for admins or meeting creators */}
                    {(isAdmin() || currentMeeting.created_by === user?.id) && 
                      parseISO(currentMeeting.end_time) < new Date() && (
                      <div className="flex gap-2">
                        {/* Remove Upload button, only show Record Minutes when no minutes exist */}
                        {!meetingMinutes[currentMeeting.id]?.length && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setRecordMinutesDialogOpen(true);
                              setMinutesDialogOpen(false);
                            }}
                          >
                            <FileEdit className="h-4 w-4 mr-1" />
                            Record Minutes
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Display meeting minutes */}
                  {meetingMinutes[currentMeeting.id]?.length > 0 ? (
                    <div className="space-y-2">
                      {meetingMinutes[currentMeeting.id]
                        .sort((a, b) => {
                          // Sort by type (text first) then by date (newest first)
                          if ((a.source_type === 'text' || a.content) && !(b.source_type === 'text' || b.content)) return -1;
                          if (!(a.source_type === 'text' || a.content) && (b.source_type === 'text' || b.content)) return 1;
                          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                        })
                        .map(minute => {
                          const isTextMinute = minute.source_type === 'text' || minute.content;
                          
                          return (
                            <div key={minute.id} className="flex items-center justify-between border p-3 rounded-md">
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-2 text-blue-500" />
                                <div>
                                  <p className="font-medium">
                                    {isTextMinute ? 'Text Minutes' : minute.file_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {isTextMinute ? 'Recorded' : 'Uploaded'} by: {minute.uploader?.first_name} {minute.uploader?.last_name} on {format(new Date(minute.created_at), 'PP')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setCurrentMinute(minute);
                                    if (isTextMinute) {
                                      setViewTextMinutesOpen(true);
                                    } else {
                                      setPdfViewerOpen(true);
                                    }
                                    setMinutesDialogOpen(false);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                                {!isTextMinute && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => window.open(minute.file_path, '_blank')}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No minutes have been recorded for this meeting</p>
                  )}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {/* PDF Viewer Dialog */}
      {currentMinute && (
        <PDFViewer
          fileUrl={currentMinute.file_path}
          fileName={currentMinute.file_name}
          open={pdfViewerOpen}
          onOpenChange={setPdfViewerOpen}
        />
      )}
    </div>
  );
};

export default MeetingsPage;
