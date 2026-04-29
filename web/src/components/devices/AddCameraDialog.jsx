import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Plus } from 'lucide-react';
import { customFetch } from '@/lib/api';

export default function AddCameraDialog({ open, onOpenChange, rooms, onSuccess }) {
  const [name, setName] = useState('');
  const [cameraType, setCameraType] = useState('webcam');
  const [roomId, setRoomId] = useState('none');
  const [streamUrl, setStreamUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Camera name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const body = {
        name: name.trim(),
        camera_type: cameraType,
      };
      if (roomId !== 'none') body.room_id = roomId;
      if (streamUrl.trim()) body.stream_url = streamUrl.trim();

      const response = await customFetch('/api/v1/cameras/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to register camera');
      }

      // Reset form
      setName('');
      setCameraType('webcam');
      setRoomId('none');
      setStreamUrl('');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md border"
        style={{
          backgroundColor: 'var(--ifrit-bg-secondary)',
          borderColor: 'var(--ifrit-border)',
        }}
      >
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
          <Camera className="w-5 h-5" style={{ color: 'var(--ifrit-amber)' }} />
          Register New Camera
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Camera Name */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
              Camera Name *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Warehouse A - North"
              className="border"
              style={{
                backgroundColor: 'var(--ifrit-bg-primary)',
                borderColor: 'var(--ifrit-border)',
                color: 'var(--ifrit-text-primary)',
              }}
            />
          </div>

          {/* Camera Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
              Camera Type
            </Label>
            <Select value={cameraType} onValueChange={setCameraType}>
              <SelectTrigger
                className="border"
                style={{
                  backgroundColor: 'var(--ifrit-bg-primary)',
                  borderColor: 'var(--ifrit-border)',
                  color: 'var(--ifrit-text-primary)',
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--ifrit-bg-secondary)',
                  borderColor: 'var(--ifrit-border)',
                }}
              >
                <SelectItem value="webcam">Webcam (USB / PC)</SelectItem>
                <SelectItem value="rtsp">RTSP (IP Camera)</SelectItem>
                <SelectItem value="http_mjpeg">HTTP MJPEG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Room Assignment */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
              Assign to Room (optional)
            </Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger
                className="border"
                style={{
                  backgroundColor: 'var(--ifrit-bg-primary)',
                  borderColor: 'var(--ifrit-border)',
                  color: 'var(--ifrit-text-primary)',
                }}
              >
                <SelectValue placeholder="No room assigned" />
              </SelectTrigger>
              <SelectContent
                style={{
                  backgroundColor: 'var(--ifrit-bg-secondary)',
                  borderColor: 'var(--ifrit-border)',
                }}
              >
                <SelectItem value="none">— No Room —</SelectItem>
                {(rooms || []).map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stream URL */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
              Stream URL (optional)
            </Label>
            <Input
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="rtsp://192.168.1.100:554/stream"
              className="border"
              style={{
                backgroundColor: 'var(--ifrit-bg-primary)',
                borderColor: 'var(--ifrit-border)',
                color: 'var(--ifrit-text-primary)',
              }}
            />
            <p className="text-[10px]" style={{ color: 'var(--ifrit-text-muted)' }}>
              For webcam testing, leave blank and use the webcam_stream.py script.
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs font-medium text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border"
              style={{
                borderColor: 'var(--ifrit-border)',
                color: 'var(--ifrit-text-secondary)',
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2"
              style={{
                backgroundColor: 'var(--ifrit-amber)',
                color: '#000',
              }}
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Registering...' : 'Register Camera'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
