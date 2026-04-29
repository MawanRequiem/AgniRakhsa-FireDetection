import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactTable({ contacts, onEdit, onDelete, onTest }) {

  return (
    <div className="border rounded-md" style={{ borderColor: 'var(--ifrit-border)' }}>
      <Table>
        <TableHeader style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}>
          <TableRow style={{ borderColor: 'var(--ifrit-border)', borderBottomWidth: '1px' }}>
            <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Name</TableHead>
            <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Phone Number</TableHead>
            <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Role</TableHead>
            <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Status</TableHead>
            <TableHead className="text-right" style={{ color: 'var(--ifrit-text-muted)' }}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id} style={{ borderColor: 'var(--ifrit-border)', borderBottomWidth: '1px' }} className="hover:bg-white/5 transition-colors">
              <TableCell className="font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
                {contact.name}
              </TableCell>
              <TableCell className="font-mono text-sm" style={{ color: 'var(--ifrit-text-secondary)' }}>
                {contact.phone}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize text-xs font-normal" style={{ 
                  color: contact.role === 'admin' ? 'var(--ifrit-info)' : 'var(--ifrit-text-secondary)',
                  borderColor: 'var(--ifrit-border)',
                  backgroundColor: 'var(--ifrit-bg-tertiary)'
                }}>
                  {contact.role}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${contact.is_active ? 'bg-[var(--ifrit-safe)]' : 'bg-[var(--ifrit-text-muted)]'}`} />
                  <span className="text-xs" style={{ color: contact.is_active ? 'var(--ifrit-safe)' : 'var(--ifrit-text-muted)' }}>
                    {contact.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[var(--ifrit-text-secondary)] hover:text-white hover:bg-[var(--ifrit-bg-tertiary)]"
                    onClick={() => onTest(contact)}
                    title="Send Test WA"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[var(--ifrit-text-secondary)] hover:text-white hover:bg-[var(--ifrit-bg-tertiary)]"
                    onClick={() => onEdit(contact)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-[var(--ifrit-fire)] hover:text-red-400 hover:bg-[rgba(248,113,113,0.1)]"
                    onClick={() => onDelete(contact.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {contacts.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center" style={{ color: 'var(--ifrit-text-muted)' }}>
                No notification contacts found. Add one above.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
