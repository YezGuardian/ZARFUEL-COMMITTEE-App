import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Upload, FileText, FileSpreadsheet, FileImage, File } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadFile } from '@/utils/downloadHelper';
import { uploadToDrive, getDriveDownloadUrl, deleteFromDrive } from '@/integrations/google/drive-api';
import { createNotification } from '@/integrations/supabase/notifications';

interface FolderContentsDialogProps {
  folder: {
    id: string;
    name: string;
    icon: string;
  };
  onClose: () => void;
}

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  created_at: string;
  uploaded_by: string | null;
  downloaded_by: any[] | null;
  category: string;
  uploader?: {
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  drive_file_id?: string;
}

const FolderContentsDialog: React.FC<FolderContentsDialogProps> = ({ folder, onClose }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    fetchDocuments();
    
    // Set up real-time updates for documents
    const docsChannel = supabase
      .channel('docs-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'documents',
          filter: `folder_id=eq.${folder.id}`
        }, 
        () => {
          fetchDocuments();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(docsChannel);
    };
  }, [folder.id]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          uploader:profiles!documents_uploaded_by_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .eq('folder_id', folder.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Cast the data to our Document type
      setDocuments(data as unknown as Document[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingFile(true);
    try {
      // Upload file to Google Drive
      const driveResult = await uploadToDrive(file, folder.name);
      
      if (!driveResult) {
        throw new Error('Failed to upload file to Google Drive');
      }
      
      // Create document record in database
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_path: driveResult.url,
          file_type: file.type.split('/').pop() || 'unknown',
          file_size: file.size,
          category: folder.name,
          folder_id: folder.id,
          uploaded_by: user.id,
          drive_file_id: driveResult.fileId // Store Google Drive file ID
        });

      if (dbError) throw dbError;
      
      toast.success('Document uploaded successfully');
      fetchDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      // If we have a Google Drive file ID, use that to get download URL
      if (document.drive_file_id) {
        const downloadUrl = getDriveDownloadUrl(document.drive_file_id);
        
        // Update downloaded_by array
        if (user) {
          const downloaded_by = document.downloaded_by || [];
          const downloadRecord = {
            user_id: user.id,
            downloaded_at: new Date().toISOString()
          };
          
          const newDownloadedBy = [...downloaded_by, downloadRecord];
          
          await supabase
            .from('documents')
            .update({
              downloaded_by: newDownloadedBy
            })
            .eq('id', document.id);
        }
        
        // Open the download URL
        window.open(downloadUrl, '_blank');
        toast.success(`Downloading ${document.file_name}`);
        return;
      }
      
      // Legacy path for older files stored in Supabase
      if (document.file_path.startsWith('http')) {
        window.open(document.file_path, '_blank');
        return;
      }
      
      // Get download URL from Supabase Storage (legacy)
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(document.file_path, 60);

      if (error) throw error;
      
      // Update downloaded_by array
      if (user) {
        const downloaded_by = document.downloaded_by || [];
        const downloadRecord = {
          user_id: user.id,
          downloaded_at: new Date().toISOString()
        };
        
        const newDownloadedBy = [...downloaded_by, downloadRecord];
        
        await supabase
          .from('documents')
          .update({
            downloaded_by: newDownloadedBy
          })
          .eq('id', document.id);
      }
      
      // Use the helper function for download
      downloadFile(data.signedUrl, document.file_name);
      
      toast.success(`Downloading ${document.file_name}`);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!isAdmin()) return;
    
    try {
      // Find the document
      const document = documents.find(d => d.id === documentId);
      if (!document) return;
      
      // Log deletion before actual delete
      await supabase.from('deletion_logs').insert({
        table_name: 'documents',
        record_id: documentId,
        deleted_by: user?.id || '',
        deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
        details: document,
      });

      // Send notification
      await createNotification({
        userId: user.id,
        type: 'document_deleted',
        content: `${user?.user_metadata?.full_name || user?.email || ''} deleted document: ${document.file_name}`,
        link: '/documents',
      });

      // If it's a Google Drive file, delete it from Drive
      if (document.drive_file_id) {
        await deleteFromDrive(document.drive_file_id);
      }
      // If it's a legacy Supabase storage file
      else if (!document.file_path.startsWith('http')) {
        // Delete the file from Supabase storage
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([document.file_path]);
          
        if (storageError) throw storageError;
      }
      
      // Delete the database record
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
        
      if (dbError) throw dbError;
      
      setDocuments(documents.filter(d => d.id !== documentId));
      toast.success('Document deleted successfully');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'docx':
      case 'doc':
        return <FileText className="h-8 w-8 text-blue-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FileImage className="h-8 w-8 text-purple-500" />;
      default:
        return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{folder.name} Documents</DialogTitle>
      </DialogHeader>
      
      <ScrollArea className="max-h-[calc(85vh-140px)]">
        <div className="space-y-4">
          {isAdmin() && (
            <div className="mb-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="w-full"
              >
                {uploadingFile ? (
                  "Uploading..."
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Upload Document
                  </>
                )}
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between bg-card border rounded-md p-3">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(doc.file_type)}
                    <div>
                      <h4 className="font-medium">{doc.file_name}</h4>
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size)} • Uploaded {formatDate(doc.created_at)}
                        {doc.uploader && ` by ${doc.uploader.first_name || ''} ${doc.uploader.last_name || ''}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {isAdmin() && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <File className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No documents</h3>
              <p className="text-sm text-muted-foreground">
                Upload documents to this folder
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </>
  );
};

export default FolderContentsDialog;
