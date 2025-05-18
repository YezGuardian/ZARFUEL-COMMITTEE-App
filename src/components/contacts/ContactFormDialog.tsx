import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createContactNotification } from '@/utils/notificationService';

interface ContactFormDialogProps {
  open: boolean; // Changed from isOpen to open
  onOpenChange: (open: boolean) => void; // Changed from onClose
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    title?: string;
    company?: string;
    role?: string;
  };
  onSuccess: () => void;
}

const ContactFormDialog: React.FC<ContactFormDialogProps> = ({
  open, // Changed from isOpen
  onOpenChange, // Changed from onClose
  contact,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    title: '',
    company: '',
    role: '',
    visibility: 'public',
    company_visibility: 'public',
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        title: contact.title || '',
        company: contact.company || '',
        role: contact.role || '',
        visibility: 'public',
        company_visibility: 'public',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        title: '',
        company: '',
        role: '',
        visibility: 'public',
        company_visibility: 'public',
      });
    }
  }, [contact, open]); // Changed from isOpen to open

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Contact name is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (contact?.id) {
        // Update existing contact
        const { error } = await supabase
          .from('contacts')
          .update({
            name: formData.name, // Make sure name is included and not optional
            email: formData.email || null,
            phone: formData.phone || null,
            title: formData.title || null,
            company: formData.company || null,
            role: formData.role || null,
            visibility: formData.visibility,
            company_visibility: formData.company_visibility,
          })
          .eq('id', contact.id);

        if (error) throw error;
        
        // Send notification for contact update
        await createContactNotification({
          contactId: contact.id,
          contactName: formData.name,
          action: 'updated',
          performedBy: user?.user_metadata?.full_name || user?.email || '',
          excludeUserId: user?.id
        });
        
        toast.success('Contact updated successfully');
      } else {
        // Create new contact
        const { data, error } = await supabase.from('contacts').insert({
          name: formData.name, // Make sure name is included and required
          email: formData.email || null,
          phone: formData.phone || null,
          title: formData.title || null,
          company: formData.company || null,
          role: formData.role || null,
          visibility: formData.visibility,
          company_visibility: formData.company_visibility,
          created_by: user?.id,
        }).select();

        if (error) throw error;
        
        // Send notification for contact creation
        if (data && data[0]) {
          await createContactNotification({
            contactId: data[0].id,
            contactName: formData.name,
            action: 'created',
            performedBy: user?.user_metadata?.full_name || user?.email || '',
            excludeUserId: user?.id
          });
        }
        
        toast.success('Contact created successfully');
      }
      onSuccess();
      onOpenChange(false); // Changed from onClose to onOpenChange(false)
    } catch (error) {
      console.error('Error saving contact:', error);
      toast.error('Failed to save contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
          <DialogDescription>
            {contact
              ? 'Update contact details in your address book'
              : 'Add a new contact to your address book'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="work">Work Details</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name*
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  Phone
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>
            </TabsContent>

            <TabsContent value="work" className="space-y-4 pt-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company" className="text-right">
                  Company
                </Label>
                <Input
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Input
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="col-span-3"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : contact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactFormDialog;
