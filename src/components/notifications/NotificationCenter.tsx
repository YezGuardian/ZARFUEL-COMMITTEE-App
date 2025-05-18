import React from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/contexts/NotificationsContext';
import { formatDistanceToNow } from 'date-fns';
import { Notification } from '@/types';
import { useNavigate } from 'react-router-dom';
import { NOTIFICATION_TYPES } from '@/utils/notificationService';

const NotificationItem: React.FC<{ notification: Notification; onRead: (id: string) => Promise<void> }> = ({ 
  notification, 
  onRead 
}) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    onRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
  };
  
  // Map notification types to icons
  const iconMap: Record<string, string> = {
    // Task notifications
    [NOTIFICATION_TYPES.TASK_CREATED]: "✏️",
    [NOTIFICATION_TYPES.TASK_UPDATED]: "🔄",
    [NOTIFICATION_TYPES.TASK_COMPLETED]: "✅",
    [NOTIFICATION_TYPES.TASK_DELETED]: "🗑️",
    
    // Meeting notifications
    [NOTIFICATION_TYPES.MEETING_CREATED]: "📅",
    [NOTIFICATION_TYPES.MEETING_UPDATED]: "🔄",
    [NOTIFICATION_TYPES.MEETING_DELETED]: "❌",
    
    // Budget notifications
    [NOTIFICATION_TYPES.BUDGET_CREATED]: "💰",
    [NOTIFICATION_TYPES.BUDGET_UPDATED]: "💱",
    [NOTIFICATION_TYPES.BUDGET_DELETED]: "🗑️",
    
    // Risk notifications
    [NOTIFICATION_TYPES.RISK_CREATED]: "⚠️",
    [NOTIFICATION_TYPES.RISK_UPDATED]: "🔄",
    [NOTIFICATION_TYPES.RISK_DELETED]: "🗑️",
    
    // Legacy types
    "task_created": "✏️",
    "task_updated": "🔄",
    "comment_added": "💬",
    "meeting_scheduled": "📅",
    "document_uploaded": "📁"
  };
  
  return (
    <div 
      className={`p-3 border-b last:border-0 cursor-pointer transition-colors ${
        notification.is_read || notification.read ? 'opacity-50' : 'bg-blue-50'
      }`} 
      onClick={handleClick}
    >
      <div className="flex items-start gap-2">
        <div className="text-lg">{iconMap[notification.type] || "🔔"}</div>
        <div className="flex-1">
          <p className="text-sm font-medium">{notification.content}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        {!(notification.is_read || notification.read) && (
          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
        )}
      </div>
    </div>
  );
};

const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-zarfuel-blue" 
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
          <h4 className="font-medium text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all as read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
                onRead={markAsRead} 
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Bell className="h-12 w-12 stroke-1 mb-2" />
              <p>No notifications yet</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
