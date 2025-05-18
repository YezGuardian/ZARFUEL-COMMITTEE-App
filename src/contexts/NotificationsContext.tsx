import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Define notification type
interface Notification {
  id: string;
  user_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  type: string;
  link?: string;
}

// Define context type
type NotificationsContextType = {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
};

// Create context
const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// Provider component
export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const fetchNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setNotifications(data || []);
    } catch (error: unknown) {
      console.error('Error fetching notifications:', error);
      toast.error(`Failed to load notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error: unknown) {
      console.error('Error marking notification as read:', error);
      toast.error(`Failed to update notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  const markAllAsRead = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);
        
      if (error) throw error;
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
    } catch (error: unknown) {
      console.error('Error marking all notifications as read:', error);
      toast.error(`Failed to update notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Calculate unread count
  const unreadCount = notifications.reduce((count, n) => n.is_read ? count : count + 1, 0);
  
  // Auto-remove read notifications older than 1 day
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => prev.filter(n => {
        if (!n.is_read) return true;
        const created = new Date(n.created_at).getTime();
        const now = Date.now();
        // 1 day = 24 * 60 * 60 * 1000 ms
        return now - created < 24 * 60 * 60 * 1000;
      }));
    }, 60 * 1000); // Check every minute
    return () => clearInterval(interval);
  }, []);
  
  // Subscribe to new notifications (real-time for current user)
  useEffect(() => {
    fetchNotifications();
    let userId: string | undefined;
    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data?.user?.id;
    })();
    const channel = supabase
      .channel('notifications-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        if (payload.new && userId && payload.new.user_id === userId) {
          setNotifications(prev => [payload.new as Notification, ...prev]);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  
  // Context value
  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchNotifications
  };
  
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

// Hook function
export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};