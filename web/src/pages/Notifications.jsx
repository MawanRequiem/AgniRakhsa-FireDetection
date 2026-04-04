import { useState } from 'react';
import ContactTable from '@/components/notifications/ContactTable';
import ContactForm from '@/components/notifications/ContactForm';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to remove this contact?')) {
      setContacts(contacts.filter(c => c.id !== id));
      toast.success('Contact removed successfully');
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
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--agni-text-primary)' }}>Notification Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--agni-text-muted)' }}>Manage WhatsApp recipients for system alerts and critical warnings.</p>
      </div>

      {/* Gateway Status Card */}
      <div className="flex items-center justify-between p-4 rounded-md border" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }}>
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--agni-text-primary)' }}>WhatsApp Gateway Status</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--agni-text-muted)' }}>Responsible for delivering automated messages to contacts below.</p>
        </div>
        <div className="flex items-center gap-2">
          {whatsappConnected ? (
             <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--agni-safe)' }}>
                <CheckCircle2 className="w-4 h-4" /> Connected
             </span>
          ) : (
             <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--agni-fire)' }}>
                <AlertCircle className="w-4 h-4" /> Disconnected
             </span>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div>
        <div className="flex items-center justify-between mb-4">
           <h2 className="text-lg font-medium" style={{ color: 'var(--agni-text-primary)' }}>Emergency Contacts</h2>
           <Button 
             onClick={handleAdd}
             size="sm" 
             className="text-black font-semibold hover:bg-[var(--agni-amber-hover)] transition-colors"
             style={{ backgroundColor: 'var(--agni-amber)' }}
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
    </div>
  );
}
