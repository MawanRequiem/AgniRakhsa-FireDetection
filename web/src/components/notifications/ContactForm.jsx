import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ContactForm({ open, onOpenChange, contact, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '+62',
    role: 'security',
    is_active: true,
  });

  useEffect(() => {
    if (contact) {
      setFormData(contact);
    } else {
      setFormData({ name: '', phone: '+62', role: 'security', is_active: true });
    }
  }, [contact, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" style={{ 
        backgroundColor: 'var(--ifrit-bg-tertiary)', 
        borderColor: 'var(--ifrit-border)',
        color: 'var(--ifrit-text-primary)'
      }}>
        <DialogHeader>
          <DialogTitle>{contact ? 'Ubah Kontak' : 'Tambah Kontak Baru'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" style={{ color: 'var(--ifrit-text-secondary)' }}>Nama Lengkap</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Contoh: Budi Santoso"
              required
              style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone" style={{ color: 'var(--ifrit-text-secondary)' }}>Nomor WhatsApp</Label>
            <Input 
              id="phone" 
              value={formData.phone} 
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="+628123..."
              required
              className="font-mono"
              style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
            />
            <p className="text-[10px]" style={{ color: 'var(--ifrit-text-muted)' }}>Gunakan kode negara di depan nomor (Contoh: +62 untuk Indonesia)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" style={{ color: 'var(--ifrit-text-secondary)' }}>Peran</Label>
            <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
              <SelectTrigger style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>
                <SelectValue placeholder="Pilih peran" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="security">Petugas Keamanan / Satpam</SelectItem>
                <SelectItem value="manager">Pengelola Gedung</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
            >
              Batal
            </Button>
            <Button 
              type="submit"
              className="hover:bg-[var(--ifrit-amber-hover)] text-black font-semibold"
              style={{ backgroundColor: 'var(--ifrit-amber)' }}
            >
              {contact ? 'Simpan Perubahan' : 'Tambah Kontak'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
