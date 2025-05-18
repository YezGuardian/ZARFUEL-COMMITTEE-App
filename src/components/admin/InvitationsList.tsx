import React, { useEffect, useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCcw, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { createNotification } from '@/utils/notificationService';
import { useAuth } from '@/contexts/AuthContext';

type Invitation = {
  id: string;
  email: string;
  role: string;
  organization: string | null;
  position: string | null;
  created_at: string;
  expires_at: string;
};

type PendingUser = {
  id: string;
  email: string;
  role: string;
  organization: string | null;
  position: string | null;
  created_at: string;
  isInvitation: boolean; // Whether this is from invitations table or profiles table
};

const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';

const InvitationsList: React.FC = () => {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  const fetchPendingUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching pending users...');
      
      // TODO: Replace with a call to a backend API endpoint that fetches invitations securely
      const response = await fetch(`${API_BASE_URL}/list-invitations`);
      const { invitations, error: invitationsError } = await response.json();
      
      if (invitationsError) {
        console.error('Error fetching invitations:', invitationsError);
        toast.error(`Failed to load invitations: ${invitationsError.message}`);
        setPendingUsers([]);
        return;
      }
      
      console.log('Invitations fetched:', invitations?.length || 0);
      
      // TODO: Replace with a call to a backend API endpoint that fetches profiles securely
      const profilesResponse = await fetch(`${API_BASE_URL}/list-profiles`);
      const { profiles: allProfiles, error: profilesError } = await profilesResponse.json();
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast.error(`Failed to load profiles: ${profilesError.message}`);
        setPendingUsers([]);
        return;
      }
      
      // Create a set of all registered emails
      const registeredEmails = new Set<string>(
        (allProfiles || []).map(profile => profile.email.toLowerCase())
      );
      
      console.log('Registered emails count:', registeredEmails.size);
      
      // Filter invitations to only include those not already registered
      const pendingInvitations = (invitations || []).filter(invitation => 
        !registeredEmails.has(invitation.email.toLowerCase())
      );
      
      console.log('Pending invitations count:', pendingInvitations.length);
      
      // Convert invitations to PendingUser format
      const invitationUsers: PendingUser[] = pendingInvitations.map(invitation => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organization: invitation.organization,
        position: invitation.position,
        created_at: invitation.created_at,
        isInvitation: true
      }));
      
      setPendingUsers(invitationUsers);
    } catch (error: unknown) {
      console.error('Error fetching pending users:', error);
      toast.error(`Failed to load pending users: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setPendingUsers([]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchPendingUsers();
  }, []);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPendingUsers();
    setRefreshing(false);
  };
  
  const handleDelete = async (pendingUser: PendingUser) => {
    try {
      if (pendingUser.isInvitation) {
        // Log deletion before actual delete
        await supabase.from('deletion_logs').insert({
          table_name: 'invitations',
          record_id: pendingUser.id,
          deleted_by: user?.id || '',
          deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
          details: pendingUser,
        });

        // Send notification
        await createNotification({
          userId: user.id,
          type: 'invitation_deleted',
          content: `${user?.user_metadata?.full_name || user?.email || ''} deleted invitation for: ${pendingUser.email}`,
          link: '/admin/users',
        });

        // Delete invitation
        const response = await fetch(`${API_BASE_URL}/delete-invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pendingUser.id }),
        });
        const { error } = await response.json();
        
        if (error) {
          throw error;
        }
      } else {
        // Log deletion before actual delete
        await supabase.from('deletion_logs').insert({
          table_name: 'profiles',
          record_id: pendingUser.id,
          deleted_by: user?.id || '',
          deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
          details: pendingUser,
        });

        // Send notification
        await createNotification({
          userId: user.id,
          type: 'user_deleted',
          content: `${user?.user_metadata?.full_name || user?.email || ''} deleted user: ${pendingUser.email}`,
          link: '/admin/users',
        });

        // Delete profile
        const response = await fetch(`${API_BASE_URL}/delete-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pendingUser.id }),
        });
        const { error } = await response.json();
        
        if (error) {
          throw error;
        }
        
        // Delete auth user
        const authResponse = await fetch(`${API_BASE_URL}/delete-auth-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pendingUser.id }),
        });
        const { error: authError } = await authResponse.json();
        
        if (authError) {
          console.error('Error deleting auth user:', authError);
          // Continue anyway
        }
      }
      
      setPendingUsers(pendingUsers.filter(u => u.id !== pendingUser.id));
      toast.success(`User ${pendingUser.email} removed`);
    } catch (error: unknown) {
      console.error('Error deleting user:', error);
      toast.error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleResend = async (user: PendingUser) => {
    try {
      // TODO: Replace with a call to a backend API endpoint that sends a password reset email
      const response = await fetch(`${API_BASE_URL}/send-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const { error } = await response.json();
      
      if (error) {
        throw error;
      }
      
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (error: unknown) {
      console.error('Error sending password reset:', error);
      toast.error(`Failed to send password reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Pending Invitations</CardTitle>
          <CardDescription>
            Users who have been invited but haven't registered yet
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || loading}
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No pending users found
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.isInvitation ? 'Invitation Sent' : 'Needs Setup'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleResend(user)}
                          title="Send password reset email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDelete(user)}
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InvitationsList;
