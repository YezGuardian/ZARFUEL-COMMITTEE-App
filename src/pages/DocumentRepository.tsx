import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createNotification, createRepositoryNotification } from '@/utils/notificationService';

interface Repository {
  id: string;
  name: string;
  url: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

const DocumentRepository = () => {
  const { user, isAdmin: checkIsAdmin, canEditPage } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [currentRepo, setCurrentRepo] = useState<Repository | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const isAdmin = checkIsAdmin();
  const canEdit = canEditPage('documents');
  
  useEffect(() => {
    fetchRepositories();
  }, []);
  
  const fetchRepositories = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Try to fetch data from the document_repositories table
      const { data, error } = await supabase
        .from('document_repositories')
        .select('*')
        .order('name');
        
      if (error) {
        console.error('Error fetching repositories:', error);
        setError('The document repositories feature is not yet available. Please check the setup guide.');
        return;
      }
      
      setRepositories(data as Repository[] || []);
    } catch (error) {
      console.error('Error in repository fetch:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const addRepository = async () => {
    if (!newRepoName.trim() || !newRepoUrl.trim()) return;
    
    try {
      setIsLoading(true);
      
      // Add http:// if missing
      let url = newRepoUrl.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      const newRepo = {
        name: newRepoName.trim(),
        url,
        created_by: user?.id
      };
      
      const { data, error } = await supabase
        .from('document_repositories')
        .insert(newRepo)
        .select();
        
      if (error) {
        console.error('Error adding repository:', error);
        toast.error('Failed to add repository');
        return;
      }
      
      const newRepository = data[0] as Repository;
      setRepositories([...repositories, newRepository]);
      
      // Send notification to all admins/special/superadmins
      await createRepositoryNotification({
        repositoryId: newRepository.id,
        repositoryName: newRepository.name,
        action: 'created',
        performedBy: user?.user_metadata?.full_name || user?.email || '',
        excludeUserId: user?.id
      });
      
      setDialogOpen(false);
      setNewRepoName('');
      setNewRepoUrl('');
      toast.success('Repository added successfully');
    } catch (error) {
      console.error('Error adding repository:', error);
      toast.error('Failed to add repository');
    } finally {
      setIsLoading(false);
    }
  };

  const editRepository = async () => {
    if (!currentRepo || !newRepoName.trim() || !newRepoUrl.trim()) return;
    
    try {
      setIsLoading(true);
      
      // Add http:// if missing
      let url = newRepoUrl.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      const updatedRepo = {
        name: newRepoName.trim(),
        url,
      };
      
      const { error } = await supabase
        .from('document_repositories')
        .update(updatedRepo)
        .eq('id', currentRepo.id);
        
      if (error) {
        console.error('Error updating repository:', error);
        toast.error('Failed to update repository');
        return;
      }
      
      // Update local state
      setRepositories(repositories.map(repo => 
        repo.id === currentRepo.id ? {...repo, ...updatedRepo} : repo
      ));
      
      // Send notification to all admins/special/superadmins
      await createRepositoryNotification({
        repositoryId: currentRepo.id,
        repositoryName: newRepoName.trim(),
        action: 'updated',
        performedBy: user?.user_metadata?.full_name || user?.email || '',
        excludeUserId: user?.id
      });
      
      setEditDialogOpen(false);
      setCurrentRepo(null);
      setNewRepoName('');
      setNewRepoUrl('');
      toast.success('Repository updated successfully');
    } catch (error) {
      console.error('Error updating repository:', error);
      toast.error('Failed to update repository');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRepository = async () => {
    if (!currentRepo) return;
    
    try {
      setIsLoading(true);
      
      // Log deletion before actual delete
      await supabase.from('deletion_logs').insert({
        table_name: 'document_repositories',
        record_id: currentRepo.id,
        deleted_by: user?.id || '',
        deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
        details: currentRepo,
      });

      // Send notification to all admins/special/superadmins
      await createRepositoryNotification({
        repositoryId: currentRepo.id,
        repositoryName: currentRepo.name,
        action: 'deleted',
        performedBy: user?.user_metadata?.full_name || user?.email || '',
        excludeUserId: user?.id
      });
      
      const { error } = await supabase
        .from('document_repositories')
        .delete()
        .eq('id', currentRepo.id);
        
      if (error) {
        console.error('Error deleting repository:', error);
        toast.error('Failed to delete repository');
        return;
      }
      
      // Update local state
      setRepositories(repositories.filter(repo => repo.id !== currentRepo.id));
      
      setDeleteDialogOpen(false);
      setCurrentRepo(null);
      toast.success('Repository deleted successfully');
    } catch (error) {
      console.error('Error deleting repository:', error);
      toast.error('Failed to delete repository');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleEditClick = (repo: Repository) => {
    setCurrentRepo(repo);
    setNewRepoName(repo.name);
    setNewRepoUrl(repo.url);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (repo: Repository) => {
    setCurrentRepo(repo);
    setDeleteDialogOpen(true);
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Document Repository</h1>
          <p className="text-muted-foreground">Access important documents and resources</p>
        </div>
        
        {canEdit && (
          <Button 
            onClick={() => setDialogOpen(true)}
            className="bg-zarfuel-blue hover:bg-zarfuel-blue/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Repository
          </Button>
        )}
      </div>
      
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading repositories...</span>
        </div>
      )}
      
      {!isLoading && error && (
        <Card className="text-center p-8">
          <CardContent>
            <p className="text-lg font-medium text-red-500">Error</p>
            <p className="text-muted-foreground mt-1">{error}</p>
            {isAdmin && (
              <div className="mt-4 space-y-2">
                <Button 
                  onClick={fetchRepositories}
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {!isLoading && !error && repositories.length === 0 && (
        <Card className="text-center p-8">
          <CardContent>
            <p className="text-lg font-medium">No document repositories found</p>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? 'Click the "Add Repository" button to add a new document location.' 
                : 'Check back later for document repositories.'}
            </p>
          </CardContent>
        </Card>
      )}
      
      {!isLoading && !error && repositories.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repositories.map((repo) => (
            <Card key={repo.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">{repo.name}</h3>
                    {canEdit && (
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(repo)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(repo)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between mt-2"
                    onClick={() => handleOpenLink(repo.url)}
                  >
                    <span>Open Repository</span>
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Add Repository Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Repository</DialogTitle>
            <DialogDescription>
              Add a link to an external document storage location.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Repository Name</Label>
              <Input
                id="name"
                placeholder="e.g., Company Policies"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="url">Repository URL</Label>
              <Input
                id="url"
                placeholder="e.g., https://example.com/documents"
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addRepository}
              disabled={!newRepoName.trim() || !newRepoUrl.trim() || isLoading}
            >
              {isLoading ? 'Adding...' : 'Add Repository'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Repository Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Repository</DialogTitle>
            <DialogDescription>
              Update the repository details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Repository Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Company Policies"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-url">Repository URL</Label>
              <Input
                id="edit-url"
                placeholder="e.g., https://example.com/documents"
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditDialogOpen(false);
                setCurrentRepo(null);
                setNewRepoName('');
                setNewRepoUrl('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={editRepository}
              disabled={!newRepoName.trim() || !newRepoUrl.trim() || isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Repository</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{currentRepo?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setCurrentRepo(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteRepository}
              className="bg-red-500 hover:bg-red-700 text-white"
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DocumentRepository; 