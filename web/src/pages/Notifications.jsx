import { useState } from 'react';
import ContactTable from '@/components/notifications/ContactTable';
import ContactForm from '@/components/notifications/ContactForm';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, AlertCircle } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';

// Local contacts data — will be replaced with a backend API when ready
const INITIAL_CONTACTS = [
  { id: 'C001', name: 'Budi Santoso', phone: '+6281234567890', role: 'admin', active: true, lastNotified: null },
  { id: 'C002', name: 'Siti Rahayu', phone: '+6289876543210', role: 'security', active: true, lastNotified: null },
];

export default function Notifications() {
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const handleAdd = () => {
    setEditingContact(null);
    setIsFormOpen(true);
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = (id) => {
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      setContacts(contacts.filter(c => c.id !== deletingId));
      toast.success('Contact removed successfully');
      setDeletingId(null);
    }
  };

  const handleSave = (contact) => {
    if (editingContact) {
      setContacts(contacts.map(c => c.id === contact.id ? contact : c));
      toast.success('Contact updated');
    } else {
      setContacts([...contacts, contact]);
      toast.success('New contact added');
    }
  };

  // Simple WA gateway status — placeholder until real status endpoint
  const whatsappConnected = false;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Alert Recipients</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>Add people who should receive automatic emergency messages on WhatsApp.</p>
      </div>

      {/* Gateway Status Card */}
      <div className="flex items-center justify-between p-4 rounded-md border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>Messaging System Status</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>This system sends automatic WhatsApp alerts during emergencies.</p>
        </div>
        <div className="flex items-center gap-2">
          {whatsappConnected ? (
             <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--ifrit-safe)' }}>
                <CheckCircle2 className="w-4 h-4" /> Connected
             </span>
          ) : (
             <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--ifrit-fire)' }}>
                <AlertCircle className="w-4 h-4" /> Disconnected
             </span>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div>
        <div className="flex items-center justify-between mb-4">
           <h2 className="text-lg font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>Emergency Contacts</h2>
           <Button 
             onClick={handleAdd}
             size="sm" 
             className="text-[var(--ifrit-bg-primary)] font-semibold hover:bg-[var(--ifrit-amber-hover)] transition-colors"
             style={{ backgroundColor: 'var(--ifrit-amber)' }}
           >
             <Plus className="w-4 h-4 mr-2" /> Add Contact
           </Button>
        </div>
        
        <ContactTable 
          contacts={contacts} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      </div>

      <ContactForm 
        open={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        contact={editingContact} 
        onSave={handleSave} 
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: 'var(--ifrit-text-primary)' }}>Remove Contact</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ifrit-text-muted)' }}>
              Are you sure you want to remove this contact? They will no longer receive emergency alerts via WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} style={{ backgroundColor: 'var(--ifrit-fire)', color: 'white' }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
