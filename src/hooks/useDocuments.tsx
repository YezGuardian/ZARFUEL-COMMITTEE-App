import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Document } from '@/types/document';
import { useAuth } from '@/contexts/AuthContext';
import { createNotification } from '@/utils/notificationService';

interface Folder {
  id: string;
  name: string;
  icon: string;
  created_at: string;
  created_by: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export const useDocuments = () => {
  const { user, isAdmin, profile } = useAuth();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Fetch documents, folders and users
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch documents
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select(`
            *,
            uploader:uploaded_by(
              first_name,
              last_name,
              email
            )
          `)
          .order('created_at', { ascending: false });
          
        if (documentsError) throw documentsError;
        
        // Fix for TS error by ensuring the data matches Document type
        const typedDocuments: Document[] = documentsData?.map(doc => {
          // Handle the case where uploader might be null or an error object
          let uploaderValue: Document['uploader'] = null;
          if (doc.uploader && typeof doc.uploader === 'object') {
            // Check if uploader has the required properties before accessing them
            uploaderValue = {
              first_name: doc.uploader?.first_name || null,
              last_name: doc.uploader?.last_name || null,
              email: doc.uploader?.email || ''
            };
          }
          
          return {
            ...doc,
            downloaded_by: Array.isArray(doc.downloaded_by) ? doc.downloaded_by : (doc.downloaded_by ? [doc.downloaded_by] : []),
            uploader: uploaderValue
          };
        }) || [];
        
        // Fetch folders
        const { data: foldersData, error: foldersError } = await supabase
          .from('folders')
          .select('*')
          .order('name');
          
        if (foldersError) throw foldersError;
        
        // Fetch users for display
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email');
          
        if (usersError) throw usersError;
        
        setDocuments(typedDocuments);
        setFolders(foldersData || []);
        setUsers(usersData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Handle document download
  const handleDownload = async (document: Document) => {
    window.open(document.file_path, '_blank');
    
    // Track download
    if (user) {
      try {
        // Get current downloaded_by
        const { data, error } = await supabase
          .from('documents')
          .select('downloaded_by')
          .eq('id', document.id)
          .single();
          
        if (error) throw error;
        
        // Fix for TS error by handling downloaded_by array safely
        const downloadedBy = data?.downloaded_by ? 
          (Array.isArray(data.downloaded_by) ? data.downloaded_by : []) : [];
        
        const newDownloadedBy = [
          ...downloadedBy, 
          { 
            user_id: user.id, 
            name: `${profile?.first_name || ''} ${profile?.last_name || ''}`,
            email: user.email,
            timestamp: new Date().toISOString()
          }
        ];
        
        await supabase
          .from('documents')
          .update({ downloaded_by: newDownloadedBy })
          .eq('id', document.id);
          
        // Create notification for admin users when a document is downloaded
        if (isAdmin()) {
          const notificationContent = `${profile?.first_name || user.email} downloaded ${document.file_name}`;
          
          await supabase
            .from('notifications')
            .insert([
              {
                user_id: user.id,
                type: 'document',
                content: notificationContent,
                link: '/documents'
              }
            ]);
        }
      } catch (error) {
        console.error('Error tracking download:', error);
      }
    }
  };

  // Handle document deletion
  const handleDelete = async (documentId: string, documentName: string) => {
    if (!isAdmin()) {
      toast.error('Only admins can delete documents');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return;
    }
    
    try {
      // Log deletion before actual delete
      await supabase.from('deletion_logs').insert({
        table_name: 'documents',
        record_id: documentId,
        deleted_by: user?.id || '',
        deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
        details: documents.find(d => d.id === documentId),
      });

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
        
      if (error) throw error;
      
      setDocuments(documents.filter(doc => doc.id !== documentId));
      toast.success('Document deleted successfully');
      
      // Create notification for admin users
      if (user && isAdmin()) {
        await createNotification({
          userId: user.id,
          type: 'document_deleted',
          content: `${user?.user_metadata?.full_name || user?.email || ''} deleted document: ${documentName}`,
          link: '/documents'
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  return {
    documents,
    folders,
    users,
    isLoading,
    formatFileSize,
    handleDownload,
    handleDelete,
    setDocuments,
    setFolders
  };
};
