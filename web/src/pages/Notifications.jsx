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
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected' | 'qr'
  const [whatsappQr, setWhatsappQr] = useState(null);
  const [pollInterval, setPollInterval] = useState(30000);

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
      toast.error('Gagal memuat daftar kontak');
    } finally {
      setIsLoading(false);
    }
  };

  // Check WhatsApp Gateway status
  const checkGatewayStatus = async () => {
    try {
      // We check via the backend to avoid CORS issues and local browser errors
      const res = await customFetch('/api/v1/notifications/whatsapp/status'); 
      if (res.ok) {
        const data = await res.json();
        setWhatsappConnected(data.connected === true);
        setWhatsappStatus(data.status || 'disconnected');
        setWhatsappQr(data.qr || null);
        
        // Speed up polling whenever not connected so QR appears instantly
        if (data.connected) {
          setPollInterval(30000);
        } else {
          setPollInterval(4000); // Fast poll to catch new QR codes quickly
        }
      } else {
        setWhatsappConnected(false);
        setWhatsappStatus('disconnected');
        setWhatsappQr(null);
        setPollInterval(30000);
      }
    } catch (err) {
      setWhatsappConnected(false);
      setWhatsappStatus('disconnected');
      setWhatsappQr(null);
      setPollInterval(30000);
    }
  };

  useEffect(() => {
    fetchContacts();
    checkGatewayStatus();
  }, []);

  useEffect(() => {
    const interval = setInterval(checkGatewayStatus, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

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
          toast.success('Kontak berhasil dihapus');
        } else {
          toast.error('Gagal menghapus kontak');
        }
      } catch (err) {
        toast.error('Kesalahan jaringan saat menghapus');
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
        toast.success(editingContact ? 'Kontak berhasil diperbarui' : 'Kontak baru berhasil ditambahkan');
        fetchContacts(); // Refresh list
      } else {
        const errData = await res.json();
        toast.error(errData.detail || 'Gagal menyimpan kontak');
      }
    } catch (err) {
      toast.error('Kesalahan jaringan saat menyimpan');
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
        toast.success(`Pesan uji coba terkirim ke ${contact.name}`);
      } else {
        toast.error('Gagal mengirim pesan uji coba');
      }
    } catch (err) {
      toast.error('Kesalahan jaringan saat uji coba');
    }
  };  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Penerima Notifikasi Bahaya</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>Tambahkan kontak yang akan menerima pesan darurat otomatis via WhatsApp.</p>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; opacity: 0.3; }
          50% { top: 100%; opacity: 1; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.97); opacity: 0.6; }
          50% { transform: scale(1.03); opacity: 0.9; }
          100% { transform: scale(0.97); opacity: 0.6; }
        }
        .scanner-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(to right, transparent, var(--ifrit-amber), transparent);
          box-shadow: 0 0 10px var(--ifrit-amber);
          animation: scan 3.5s linear infinite;
        }
        .pulsing-border {
          position: relative;
        }
        .pulsing-border::after {
          content: '';
          position: absolute;
          inset: -4px;
          border: 2px solid var(--ifrit-amber);
          border-radius: 8px;
          animation: pulse-ring 2.5s infinite ease-in-out;
          pointer-events: none;
        }
      `}</style>

      {/* Gateway Status Card */}
      <div className="flex items-center justify-between p-4 rounded-md border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>Status Sistem Notifikasi</h2>
          <p className="text-xs mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>Sistem ini mengirimkan pesan WhatsApp secara otomatis saat kondisi darurat terdeteksi.</p>
        </div>
        <div className="flex items-center gap-2">
          {whatsappConnected ? (
             <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--ifrit-safe)' }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--ifrit-safe)' }}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--ifrit-safe)' }}></span>
                </span>
                <CheckCircle2 className="w-4 h-4 ml-1" /> Tersambung
             </span>
          ) : whatsappStatus === 'connecting' ? (
             <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--ifrit-amber)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse bg-[var(--ifrit-amber)]" />
                Menghubungkan...
             </span>
          ) : (
             <span className="flex items-center gap-1.5 text-sm font-medium text-red-500">
                <AlertCircle className="w-4 h-4" /> Perlu Pindai QR
             </span>
          )}
        </div>
      </div>

      {/* WhatsApp Link Section */}
      {!whatsappConnected && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 p-6 rounded-md border transition-all duration-300" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
          <div className="md:col-span-3 space-y-4">
            <h3 className="text-lg font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>Tautkan Perangkat WhatsApp</h3>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--ifrit-text-muted)' }}>
              Hubungkan nomor WhatsApp Anda dengan sistem pemantauan <strong>Ifrit</strong> untuk menerima peringatan bahaya kebakaran instan ke kontak darurat.
            </p>
            
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ifrit-text-primary)' }}>Langkah Penyambungan:</h4>
              <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed" style={{ color: 'var(--ifrit-text-muted)' }}>
                <li>Buka aplikasi <strong>WhatsApp</strong> di telepon genggam Anda.</li>
                <li>Ketuk ikon <strong>Menu (⋮)</strong> atau buka <strong>Pengaturan</strong>, lalu pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                <li>Pilih tombol <strong>Tautkan Perangkat (Link a Device)</strong>.</li>
                <li>Arahkan kamera ponsel Anda ke kode QR di samping untuk mulai memindai.</li>
              </ol>
            </div>

            <div className="pt-3 flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${whatsappStatus === 'qr' ? 'bg-[var(--ifrit-amber)] animate-ping' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-xs font-semibold" style={{ color: whatsappStatus === 'qr' ? 'var(--ifrit-amber)' : 'red' }}>
                {whatsappStatus === 'qr' ? 'Siap dipindai. Menunggu pemindaian ponsel...' : 'Menghubungkan ke gateway...'}
              </span>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col items-center justify-center border-l border-t md:border-t-0 pt-6 md:pt-0 pl-0 md:pl-6 border-dashed" style={{ borderColor: 'var(--ifrit-border)' }}>
            {whatsappStatus === 'qr' && whatsappQr ? (
              <div className="relative p-4 rounded-lg bg-white shadow-xl overflow-hidden flex items-center justify-center pulsing-border" style={{ width: '220px', height: '220px' }}>
                <img 
                  src={whatsappQr} 
                  alt="WhatsApp Pairing QR" 
                  className="w-full h-full object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                {/* Scanner laser effect */}
                <div className="scanner-line" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center border rounded-lg" style={{ borderColor: 'var(--ifrit-border)', width: '220px', height: '220px', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-3" style={{ borderColor: 'var(--ifrit-amber)', borderTopColor: 'transparent' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
                  Membuat kode QR baru...
                </span>
              </div>
            )}
            <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--ifrit-text-muted)' }}>
              Kode QR di atas akan memperbarui diri secara otomatis.
            </p>
          </div>
        </div>
      )}

      {/* Contacts List */}
      <div>
        <div className="flex items-center justify-between mb-4">
           <h2 className="text-lg font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>Kontak Darurat</h2>
           <Button 
             onClick={handleAdd}
             size="sm" 
             className="text-[var(--ifrit-bg-primary)] font-semibold hover:bg-[var(--ifrit-amber-hover)] transition-colors"
             style={{ backgroundColor: 'var(--ifrit-amber)' }}
           >
             <Plus className="w-4 h-4 mr-2" /> Tambah Kontak
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
            <AlertDialogTitle style={{ color: 'var(--ifrit-text-primary)' }}>Hapus Kontak</AlertDialogTitle>
            <AlertDialogDescription style={{ color: 'var(--ifrit-text-muted)' }}>
              Apakah Anda yakin ingin menghapus kontak ini? Mereka tidak akan lagi menerima notifikasi peringatan bahaya via WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} style={{ backgroundColor: 'var(--ifrit-fire)', color: 'white' }}>
              Hapus Kontak
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
