import { useState, useEffect } from 'react';
import { customFetch } from '@/lib/api';
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

export default function Notifications() {
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  // Fetch contacts from backend
  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const res = await customFetch('/api/v1/contacts/');
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
      toast.error('Failed to load contact list');
    } finally {
      setIsLoading(false);
    }
  };

  // Check WhatsApp Gateway status
  const checkGatewayStatus = async () => {
    try {
      // We check via the backend to avoid CORS issues if the gateway is strictly local
      const res = await fetch('http://127.0.0.1:3001/'); 
      if (res.ok) {
        const data = await res.json();
        setWhatsappConnected(data.status === 'ok');
      } else {
        setWhatsappConnected(false);
      }
    } catch (err) {
      setWhatsappConnected(false);
    }
  };

  useEffect(() => {
    fetchContacts();
    checkGatewayStatus();
    
    // Poll status every 30s
    const interval = setInterval(checkGatewayStatus, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const confirmDelete = async () => {
    if (deletingId) {
      try {
        const res = await customFetch(`/api/v1/contacts/${deletingId}`, {
          method: 'DELETE'
        });
        
        if (res.status === 204) {
          setContacts(contacts.filter(c => c.id !== deletingId));
          toast.success('Contact removed successfully');
        } else {
          toast.error('Failed to remove contact');
        }
      } catch (err) {
        toast.error('Network error while deleting');
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleSave = async (contact) => {
    try {
      const method = editingContact ? 'PATCH' : 'POST';
      const endpoint = editingContact ? `/api/v1/contacts/${contact.id}` : '/api/v1/contacts/';
      
      const res = await customFetch(endpoint, {
        method,
        body: JSON.stringify(contact)
      });

      if (res.ok) {
        toast.success(editingContact ? 'Contact updated' : 'New contact added');
        fetchContacts(); // Refresh list
      } else {
        const errData = await res.json();
        toast.error(errData.detail || 'Failed to save contact');
      }
    } catch (err) {
      toast.error('Network error while saving');
    }
  };

  const handleTest = async (contact) => {
    try {
      const res = await customFetch('/api/v1/notifications/whatsapp', {
        method: 'POST',
        body: JSON.stringify({
          phone: contact.phone,
          message: `🛠 *[Ifrit] - Uji Coba Sistem*\n\nHalo ${contact.name}, ini adalah pesan otomatis untuk memastikan sistem notifikasi WhatsApp Anda telah aktif.\n\nJika Anda menerima pesan ini, berarti nomor Anda sudah terdaftar dalam sistem peringatan dini *Ifrit Fire Detection*. Tidak ada tindakan yang diperlukan saat ini.\n\n*Waktu Tes:* ${new Date().toLocaleString('id-ID')}`
        })
      });

      if (res.ok) {
        toast.success(`Test message sent to ${contact.name}`);
      } else {
        toast.error('Failed to send test message');
      }
    } catch (err) {
      toast.error('Network error while testing');
    }
  };

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
          onTest={handleTest}
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
