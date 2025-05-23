export type Status = 'complete' | 'inprogress' | 'notstarted' | 'ongoing';

export type Task = {
  id: string;
  title: string;
  description?: string;
  phase_id: string;
  phase?: string; // For display purposes
  responsible_teams?: string[];
  start_date?: string | null;
  end_date?: string | null;
  duration?: string; // Added duration field
  status: Status;
  progress: number;
  progress_summary: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  team?: string; // For display purposes
};

export type Phase = {
  id: string;
  name: string;
  description?: string;
  project_id: string;
  position: number;
  tasks?: Task[];
  created_at: string;
  updated_at: string;
  created_by?: string;
};

export type Comment = {
  id: string;
  content: string;
  task_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
};

export type Event = {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_meeting: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  participants?: EventParticipant[];
};

export type EventParticipant = {
  id: string;
  event_id: string;
  user_id: string;
  response: 'pending' | 'accepted' | 'declined';
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
};

export interface MeetingMinute {
  id: string;
  event_id: string;
  file_path: string | null;
  file_name: string | null;
  file_type?: string;
  file_size?: number;
  content?: string;
  source_type?: 'file' | 'text' | 'both';
  is_published?: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by: string;
  uploader?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export type Contact = {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  visibility: 'public' | 'admin_only' | 'company_specific';
  company_visibility?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
};

export type Document = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  category: string;
  created_at: string;
  uploaded_by?: string;
  folder_id?: string;
  downloaded_by: any[] | null;
  uploader?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
};

export type NotificationType = 
  // Task notifications
  | 'task_created' | 'task_updated' | 'task_completed' | 'task_deleted'
  // Meeting notifications
  | 'meeting_created' | 'meeting_updated' | 'meeting_deleted'
  // Budget notifications
  | 'budget_created' | 'budget_updated' | 'budget_deleted'
  // Risk notifications
  | 'risk_created' | 'risk_updated' | 'risk_deleted'
  // Legacy types
  | 'comment_added' | 'meeting_scheduled' | 'document_uploaded'
  // Fallback
  | string;

export type Notification = {
  id: string;
  type: NotificationType;
  content: string;
  link?: string;
  is_read: boolean;
  created_at: string;
  user_id: string;
};

export type User = {
  id: string;
  email: string;
  role: 'admin' | 'viewer';
  first_name?: string;
  last_name?: string;
  company?: string;
  position?: string;
  phone?: string;
  title?: string;
};
