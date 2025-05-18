import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
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
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Edit, Mail, Phone, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ContactFormDialog from '@/components/contacts/ContactFormDialog';
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
import { createNotification, createContactNotification } from '@/utils/notificationService';

interface Contact {
  id: string;
  name: string;
  email: string;
  title: string;
  phone: string;
  company: string;
  role: string;
  created_by: string;
  created_at: string;
}

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin, user } = useAuth();
  
  // Contact form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  
  // Delete dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  
  useEffect(() => {
    fetchContacts();
  }, []);
  
  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle opening the edit form
  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setIsFormOpen(true);
  };
  
  // Handle opening the add form
  const handleAdd = () => {
    setSelectedContact(null);
    setIsFormOpen(true);
  };
  
  // Handle contact deletion
  const handleDelete = async () => {
    if (!contactToDelete) return;
    try {
      // Log deletion before actual delete
      await supabase.from('deletion_logs').insert({
        table_name: 'contacts',
        record_id: contactToDelete.id,
        deleted_by: user?.id || '',
        deleted_by_name: (user?.user_metadata?.full_name || user?.email || ''),
        details: contactToDelete,
      });
      // Send notification to admins/superadmins
      await createContactNotification({
        contactId: contactToDelete.id,
        contactName: contactToDelete.name,
        action: 'deleted',
        performedBy: user?.user_metadata?.full_name || user?.email || '',
        excludeUserId: user?.id
      });
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactToDelete.id);
      if (error) throw error;
      setContacts(contacts.filter(c => c.id !== contactToDelete.id));
      toast.success('Contact deleted successfully');
      setIsDeleteDialogOpen(false);
      setContactToDelete(null);
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error(error.message || 'Failed to delete contact');
    }
  };
  
  // Open delete confirmation dialog
  const openDeleteDialog = (contact: Contact) => {
    setContactToDelete(contact);
    setIsDeleteDialogOpen(true);
  };
  
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const getColorForLetter = (letter: string) => {
    const colors = [
      'bg-red-100 text-red-800',
      'bg-yellow-100 text-yellow-800',
      'bg-green-100 text-green-800',
      'bg-blue-100 text-blue-800',
      'bg-indigo-100 text-indigo-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800'
    ];
    
    const index = letter.charCodeAt(0) % colors.length;
    return colors[index];
  };
  
  // Group contacts by first letter of name
  const groupedContacts = filteredContacts.reduce((acc, contact) => {
    const firstLetter = contact.name[0].toUpperCase();
    if (!acc[firstLetter]) {
      acc[firstLetter] = [];
    }
    acc[firstLetter].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);
  
  // Sort the letters
  const sortedLetters = Object.keys(groupedContacts).sort();
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contact Directory</h1>
          <p className="text-muted-foreground">
            Access committee member and stakeholder contact information
          </p>
        </div>
        
        {isAdmin() && (
          <Button 
            className="bg-zarfuel-blue hover:bg-zarfuel-blue/90"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        )}
      </div>
      
      {/* Search */}
      <div className="flex">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="cards">Cards View</TabsTrigger>
        </TabsList>
        
        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zarfuel-blue"></div>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No contacts found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      {isAdmin() && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map(contact => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                            </Avatar>
                            {contact.name}
                          </div>
                        </TableCell>
                        <TableCell>{contact.title || '-'}</TableCell>
                        <TableCell>{contact.company || '-'}</TableCell>
                        <TableCell>
                          {contact.email ? (
                            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {contact.email}
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {contact.phone ? (
                            <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline flex items-center">
                              <Phone className="h-3 w-3 mr-1" />
                              {contact.phone}
                            </a>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{contact.role || '-'}</TableCell>
                        {isAdmin() && (
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleEdit(contact)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => openDeleteDialog(contact)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="cards" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zarfuel-blue"></div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No contacts found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedLetters.map(letter => (
                <div key={letter} className="space-y-2">
                  <div className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${getColorForLetter(letter)} font-bold`}>
                    {letter}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {groupedContacts[letter].map(contact => (
                      <Card key={contact.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <div className="flex items-center">
                            <Avatar className="h-10 w-10 mr-3">
                              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-lg">{contact.name}</CardTitle>
                              {contact.title && (
                                <p className="text-sm text-muted-foreground">{contact.title}</p>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            {contact.company && (
                              <div className="flex items-center">
                                <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                                <span>{contact.company}</span>
                              </div>
                            )}
                            
                            {contact.email && (
                              <div className="flex items-center">
                                <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                                <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                                  {contact.email}
                                </a>
                              </div>
                            )}
                            
                            {contact.phone && (
                              <div className="flex items-center">
                                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                                <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                            
                            {contact.role && (
                              <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                                Role: {contact.role}
                              </div>
                            )}
                          </div>
                          
                          {isAdmin() && (
                            <div className="flex justify-end mt-4">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0"
                                onClick={() => handleEdit(contact)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => openDeleteDialog(contact)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Contact Form Dialog */}
      <ContactFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        contact={selectedContact}
        onSuccess={fetchContacts}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {contactToDelete?.name}'s contact information.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContactsPage;
