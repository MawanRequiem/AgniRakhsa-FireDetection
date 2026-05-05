import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import AddCameraDialog from '@/components/devices/AddCameraDialog';
import DeviceCalibrationDialog from '@/components/devices/DeviceCalibrationDialog';
import { Camera, Cpu, Plus, Trash2, Wifi, WifiOff, RefreshCw, Copy, Check, Settings2 } from 'lucide-react';
import { customFetch } from '@/lib/api';
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

export default function DeviceManagement() {
  const [cameras, setCameras] = useState([]);
  const [devices, setDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [cameraToDelete, setCameraToDelete] = useState(null);
  const [calibrationDevice, setCalibrationDevice] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [camRes, devRes, roomRes] = await Promise.all([
        customFetch('/api/v1/cameras/'),
        customFetch('/api/v1/devices/'),
        customFetch('/api/v1/rooms/'),
      ]);
      if (camRes.ok) setCameras(await camRes.json());
      if (devRes.ok) setDevices(await devRes.json());
      if (roomRes.ok) setRooms(await roomRes.json());
    } catch (err) {
      console.error('Failed to fetch device data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => {
      if (!document.hidden) fetchAll();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleCameraRoomChange = async (cameraId, newRoomId) => {
    try {
      const body = newRoomId === 'none' ? { unassign_room: true } : { room_id: newRoomId };
      const res = await customFetch(`/api/v1/cameras/${cameraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setCameras((prev) => prev.map((c) => (c.id === cameraId ? updated : c)));
      }
    } catch (err) {
      console.error('Failed to update camera room:', err);
    }
  };

  const handleDeviceRoomChange = async (deviceId, newRoomId) => {
    try {
      const body = newRoomId === 'none' ? { room_id: null } : { room_id: newRoomId };
      const res = await customFetch(`/api/v1/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setDevices((prev) => prev.map((d) => (d.id === deviceId ? updated : d)));
      }
    } catch (err) {
      console.error('Failed to update device room:', err);
    }
  };

  const handleDeleteCamera = (cameraId) => {
    setCameraToDelete(cameraId);
  };

  const confirmDeleteCamera = async () => {
    if (!cameraToDelete) return;
    try {
      const res = await customFetch(`/api/v1/cameras/${cameraToDelete}`, { method: 'DELETE' });
      if (res.ok) setCameras((prev) => prev.filter((c) => c.id !== cameraToDelete));
    } catch (err) {
      console.error('Failed to delete camera:', err);
    } finally {
      setCameraToDelete(null);
    }
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRoomName = (roomId) => {
    if (!roomId) return null;
    const room = rooms.find((r) => r.id === roomId);
    return room ? room.name : null;
  };

  const formatTime = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('en-US', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const RoomSelector = ({ currentRoomId, onChange }) => (
    <Select value={currentRoomId || 'none'} onValueChange={(val) => onChange(val)}>
      <SelectTrigger
        className="w-[180px] h-8 text-xs border"
        style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
      >
        <SelectValue>
          {currentRoomId ? (getRoomName(currentRoomId) || 'Unknown Room') : '— Unassigned —'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)' }}>
        <SelectItem value="none">
          <span style={{ color: 'var(--ifrit-text-muted)' }}>— Unassigned —</span>
        </SelectItem>
        {rooms.map((room) => (
          <SelectItem key={room.id} value={room.id}>
            {room.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Device Management</h1>
        <div className="flex flex-col items-center justify-center h-[40vh]">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-4" style={{ borderColor: 'var(--ifrit-brand)' }} />
          <p className="text-sm" style={{ color: 'var(--ifrit-text-muted)' }}>Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Manage Devices</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>Connect cameras, set up sensors, and assign them to specific areas.</p>
        </div>
        <Button
          onClick={() => fetchAll()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border cursor-pointer"
          style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cameras" className="w-full">
        <TabsList
          className="w-full justify-start h-auto p-1 mb-6"
          style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', borderBottomWidth: '1px' }}
        >
          <TabsTrigger value="cameras" className="capitalize px-4 py-2 data-[state=active]:bg-[var(--ifrit-bg-tertiary)] data-[state=active]:text-[var(--ifrit-brand)] flex items-center gap-2">
            <Camera className="w-4 h-4" /> Cameras
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>{cameras.length}</span>
          </TabsTrigger>
          <TabsTrigger value="sensors" className="capitalize px-4 py-2 data-[state=active]:bg-[var(--ifrit-bg-tertiary)] data-[state=active]:text-[var(--ifrit-brand)] flex items-center gap-2">
            <Cpu className="w-4 h-4" /> Monitoring Units
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>{devices.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* CAMERAS TAB */}
        <TabsContent value="cameras" className="mt-0 outline-none">
          <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Registered Cameras</h3>
              <Button onClick={() => setShowAddCamera(true)} size="sm" className="flex items-center gap-2 cursor-pointer text-white" style={{ backgroundColor: 'var(--ifrit-brand)' }}>
                <Plus className="w-4 h-4" /> Add Camera
              </Button>
            </div>
            {cameras.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--ifrit-text-muted)' }}>
                <Camera className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">No cameras registered</p>
                <p className="text-xs mt-1">Click "Add Camera" to register one.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'var(--ifrit-border)' }}>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Status</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Name</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Type</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Assigned Room</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Camera ID</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Last Frame</TableHead>
                    <TableHead className="text-xs font-medium text-right" style={{ color: 'var(--ifrit-text-muted)' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cameras.map((cam) => (
                    <TableRow key={cam.id} className="hover:bg-[var(--ifrit-bg-secondary)] transition-colors" style={{ borderColor: 'var(--ifrit-border)' }}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {cam.status === 'online' ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4" style={{ color: 'var(--ifrit-text-muted)' }} />}
                          <StatusIndicator status={cam.has_detection ? 'fire' : cam.status === 'online' ? 'safe' : 'offline'} size="sm" />
                        </div>
                      </TableCell>
                      <TableCell><span className="font-medium text-sm" style={{ color: 'var(--ifrit-text-primary)' }}>{cam.name}</span></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase border" style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}>
                          {cam.camera_type}
                        </Badge>
                      </TableCell>
                      <TableCell><RoomSelector currentRoomId={cam.room_id} onChange={(val) => handleCameraRoomChange(cam.id, val)} /></TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleCopyId(cam.id)}
                          className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border transition-colors cursor-pointer"
                          style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-muted)' }}
                          title="Click to copy Camera ID"
                        >
                          {copiedId === cam.id ? (<><Check className="w-3 h-3 text-emerald-400" /> Copied</>) : (<><Copy className="w-3 h-3" /> {cam.id.substring(0, 8)}…</>)}
                        </button>
                      </TableCell>
                      <TableCell><span className="text-xs font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>{formatTime(cam.last_frame_at)}</span></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCamera(cam.id)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* SENSOR NODES TAB */}
        <TabsContent value="sensors" className="mt-0 outline-none">
          <div className="border rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Internal Sensors</h3>
              <p className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>Automatically connects when turned on</p>
            </div>
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--ifrit-text-muted)' }}>
                <Cpu className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">No sensor nodes registered</p>
                <p className="text-xs mt-1">Devices connect themselves when powered on.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'var(--ifrit-border)' }}>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Status</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Name</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>MAC Address</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Assigned Room</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>System Version</TableHead>
                    <TableHead className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>Last Seen</TableHead>
                    <TableHead className="text-xs font-medium text-right" style={{ color: 'var(--ifrit-text-muted)' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((dev) => (
                    <TableRow key={dev.id} className="hover:bg-[var(--ifrit-bg-secondary)] transition-colors" style={{ borderColor: 'var(--ifrit-border)' }}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {dev.status === 'online' ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4" style={{ color: 'var(--ifrit-text-muted)' }} />}
                          <StatusIndicator status={dev.status === 'online' ? 'safe' : 'offline'} size="sm" />
                        </div>
                      </TableCell>
                      <TableCell><span className="font-medium text-sm" style={{ color: 'var(--ifrit-text-primary)' }}>{dev.name}</span></TableCell>
                      <TableCell>
                        <span className="text-xs font-mono px-2 py-1 rounded" style={{ backgroundColor: 'var(--ifrit-bg-primary)', color: 'var(--ifrit-text-secondary)' }}>
                          {dev.mac_address || '—'}
                        </span>
                      </TableCell>
                      <TableCell><RoomSelector currentRoomId={dev.room_id} onChange={(val) => handleDeviceRoomChange(dev.id, val)} /></TableCell>
                      <TableCell><span className="text-xs font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>{dev.firmware_version || '—'}</span></TableCell>
                      <TableCell><span className="text-xs font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>{formatTime(dev.last_seen)}</span></TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setCalibrationDevice(dev)} 
                          className="hover:bg-[var(--ifrit-bg-tertiary)] cursor-pointer"
                          style={{ color: 'var(--ifrit-text-secondary)' }}
                          title="Manage Calibration"
                        >
                          <Settings2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AddCameraDialog open={showAddCamera} onOpenChange={setShowAddCamera} rooms={rooms} onSuccess={fetchAll} />
      
      <DeviceCalibrationDialog 
        open={!!calibrationDevice} 
        onOpenChange={(open) => !open && setCalibrationDevice(null)} 
        device={calibrationDevice} 
      />
    </div>
  );
}
