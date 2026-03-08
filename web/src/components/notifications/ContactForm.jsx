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
    active: true,
  });

  useEffect(() => {
    if (contact) {
      setFormData(contact);
    } else {
      setFormData({ name: '', phone: '+62', role: 'security', active: true });
    }
  }, [contact, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, id: contact?.id || `C${Date.now()}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" style={{ 
        backgroundColor: 'var(--agni-bg-tertiary)', 
        borderColor: 'var(--agni-border)',
        color: 'var(--agni-text-primary)'
      }}>
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" style={{ color: 'var(--agni-text-secondary)' }}>Full Name</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Budi Santoso"
              required
              style={{ backgroundColor: 'var(--agni-bg-secondary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone" style={{ color: 'var(--agni-text-secondary)' }}>WhatsApp Number</Label>
            <Input 
              id="phone" 
              value={formData.phone} 
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="+628123..."
              required
              className="font-mono"
              style={{ backgroundColor: 'var(--agni-bg-secondary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}
            />
            <p className="text-[10px]" style={{ color: 'var(--agni-text-muted)' }}>Include country code (e.g. +62 for Indonesia)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" style={{ color: 'var(--agni-text-secondary)' }}>Role</Label>
            <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
              <SelectTrigger style={{ backgroundColor: 'var(--agni-bg-secondary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent style={{ backgroundColor: 'var(--agni-bg-secondary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}>
                <SelectItem value="admin">Administrator</SelectItem>
                <SelectItem value="security">Security Guard</SelectItem>
                <SelectItem value="manager">Facility Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              style={{ borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              className="hover:bg-[var(--agni-amber-hover)] text-black font-semibold"
              style={{ backgroundColor: 'var(--agni-amber)' }}
            >
              {contact ? 'Save Changes' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
