import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import AddCameraDialog from '@/components/devices/AddCameraDialog';
import {
  Camera,
  Cpu,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { customFetch } from '@/lib/api';

export default function DeviceManagement() {
  const [cameras, setCameras] = useState([]);
  const [devices, setDevices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

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
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Assign camera to a room
  const handleCameraRoomChange = async (cameraId, newRoomId) => {
    try {
      const body =
        newRoomId === 'none'
          ? { unassign_room: true }
          : { room_id: newRoomId };

      const res = await customFetch(`/api/v1/cameras/${cameraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setCameras((prev) =>
          prev.map((c) => (c.id === cameraId ? updated : c))
        );
      }
    } catch (err) {
      console.error('Failed to update camera room:', err);
    }
  };

  // Assign device to a room
  const handleDeviceRoomChange = async (deviceId, newRoomId) => {
    try {
      const body =
        newRoomId === 'none'
          ? { room_id: null }
          : { room_id: newRoomId };

      const res = await customFetch(`/api/v1/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? updated : d))
        );
      }
    } catch (err) {
      console.error('Failed to update device room:', err);
    }
  };

  // Delete camera
  const handleDeleteCamera = async (cameraId) => {
    if (!window.confirm('Delete this camera? The stream will disconnect.'))
      return;
    try {
      const res = await customFetch(`/api/v1/cameras/${cameraId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCameras((prev) => prev.filter((c) => c.id !== cameraId));
      }
    } catch (err) {
      console.error('Failed to delete camera:', err);
    }
  };

  // Copy UUID
  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Get room name by id
  const getRoomName = (roomId) => {
    if (!roomId) return null;
    const room = rooms.find((r) => r.id === roomId);
    return room ? room.name : null;
  };

  // Format last-seen time
  const formatTime = (isoStr) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Room dropdown selector shared component
  const RoomSelector = ({ currentRoomId, onChange }) => (
    <Select
      value={currentRoomId || 'none'}
      onValueChange={(val) => onChange(val)}
    >
      <SelectTrigger
        className="w-[180px] h-8 text-xs border"
        style={{
          backgroundColor: 'var(--agni-bg-primary)',
          borderColor: 'var(--agni-border)',
          color: 'var(--agni-text-primary)',
        }}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        style={{
          backgroundColor: 'var(--agni-bg-secondary)',
          borderColor: 'var(--agni-border)',
        }}
      >
        <SelectItem value="none">
          <span style={{ color: 'var(--agni-text-muted)' }}>— Unassigned —</span>
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
        <h1
          className="text-2xl font-semibold"
          style={{ color: 'var(--agni-text-primary)' }}
        >
          Device Management
        </h1>
        <div className="flex flex-col items-center justify-center h-[40vh]">
          <div className="w-8 h-8 border-2 border-[var(--agni-amber)] border-t-transparent rounded-full animate-spin mb-4" />
          <p
            className="text-sm font-mono"
            style={{ color: 'var(--agni-text-muted)' }}
          >
            LOADING DEVICES...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: 'var(--agni-text-primary)' }}
          >
            Device Management
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--agni-text-muted)' }}
          >
            Register cameras, manage sensor nodes, and assign them to rooms.
          </p>
        </div>
        <Button
          onClick={() => fetchAll()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 border"
          style={{
            borderColor: 'var(--agni-border)',
            color: 'var(--agni-text-secondary)',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="cameras" className="w-full">
        <TabsList
          className="w-full justify-start h-auto p-1 mb-6"
          style={{
            backgroundColor: 'var(--agni-bg-secondary)',
            borderColor: 'var(--agni-border)',
            borderBottomWidth: '1px',
          }}
        >
          <TabsTrigger
            value="cameras"
            className="capitalize px-4 py-2 data-[state=active]:bg-[var(--agni-bg-tertiary)] data-[state=active]:text-[var(--agni-amber)] flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Cameras
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--agni-bg-primary)' }}
            >
              {cameras.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="sensors"
            className="capitalize px-4 py-2 data-[state=active]:bg-[var(--agni-bg-tertiary)] data-[state=active]:text-[var(--agni-amber)] flex items-center gap-2"
          >
            <Cpu className="w-4 h-4" />
            Sensor Nodes
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--agni-bg-primary)' }}
            >
              {devices.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* ===== CAMERAS TAB ===== */}
        <TabsContent value="cameras" className="mt-0 outline-none">
          <div
            className="border rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--agni-bg-tertiary)',
              borderColor: 'var(--agni-border)',
            }}
          >
            {/* Toolbar */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--agni-border)' }}
            >
              <h3
                className="text-sm font-bold uppercase tracking-wider"
                style={{ color: 'var(--agni-text-primary)' }}
              >
                Registered Cameras
              </h3>
              <Button
                onClick={() => setShowAddCamera(true)}
                size="sm"
                className="flex items-center gap-2"
                style={{
                  backgroundColor: 'var(--agni-amber)',
                  color: '#000',
                }}
              >
                <Plus className="w-4 h-4" />
                Add Camera
              </Button>
            </div>

            {cameras.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16"
                style={{ color: 'var(--agni-text-muted)' }}
              >
                <Camera className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">No cameras registered</p>
                <p className="text-xs mt-1">
                  Click &quot;Add Camera&quot; to register one.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow
                    style={{
                      borderColor: 'var(--agni-border)',
                    }}
                  >
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Name</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Type</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Assigned Room</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Camera ID</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Last Frame</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right" style={{ color: 'var(--agni-text-muted)' }}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cameras.map((cam) => (
                    <TableRow
                      key={cam.id}
                      className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: 'var(--agni-border)' }}
                    >
                      {/* Status */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {cam.status === 'online' ? (
                            <Wifi className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <WifiOff className="w-4 h-4" style={{ color: 'var(--agni-text-muted)' }} />
                          )}
                          <StatusIndicator
                            status={cam.has_detection ? 'fire' : cam.status === 'online' ? 'safe' : 'offline'}
                            size="sm"
                          />
                        </div>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <span className="font-medium text-sm" style={{ color: 'var(--agni-text-primary)' }}>
                          {cam.name}
                        </span>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase border"
                          style={{
                            borderColor: 'var(--agni-border)',
                            color: 'var(--agni-text-secondary)',
                          }}
                        >
                          {cam.camera_type}
                        </Badge>
                      </TableCell>

                      {/* Room Assignment */}
                      <TableCell>
                        <RoomSelector
                          currentRoomId={cam.room_id}
                          onChange={(val) =>
                            handleCameraRoomChange(cam.id, val)
                          }
                        />
                      </TableCell>

                      {/* Camera ID (copyable) */}
                      <TableCell>
                        <button
                          onClick={() => handleCopyId(cam.id)}
                          className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border transition-colors hover:border-[var(--agni-amber)]"
                          style={{
                            backgroundColor: 'var(--agni-bg-primary)',
                            borderColor: 'var(--agni-border)',
                            color: 'var(--agni-text-muted)',
                          }}
                          title="Click to copy Camera ID"
                        >
                          {copiedId === cam.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              {cam.id.substring(0, 8)}…
                            </>
                          )}
                        </button>
                      </TableCell>

                      {/* Last Frame */}
                      <TableCell>
                        <span
                          className="text-xs font-mono"
                          style={{ color: 'var(--agni-text-muted)' }}
                        >
                          {formatTime(cam.last_frame_at)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCamera(cam.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
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

        {/* ===== SENSOR NODES TAB ===== */}
        <TabsContent value="sensors" className="mt-0 outline-none">
          <div
            className="border rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--agni-bg-tertiary)',
              borderColor: 'var(--agni-border)',
            }}
          >
            {/* Toolbar */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--agni-border)' }}
            >
              <h3
                className="text-sm font-bold uppercase tracking-wider"
                style={{ color: 'var(--agni-text-primary)' }}
              >
                MCU Sensor Nodes
              </h3>
              <p
                className="text-[10px] font-mono"
                style={{ color: 'var(--agni-text-muted)' }}
              >
                Auto-provisioned by firmware on boot
              </p>
            </div>

            {devices.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-16"
                style={{ color: 'var(--agni-text-muted)' }}
              >
                <Cpu className="w-10 h-10 mb-3 opacity-30" />
                <p className="font-medium">No sensor nodes registered</p>
                <p className="text-xs mt-1">
                  Devices self-register when the MCU firmware boots.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'var(--agni-border)' }}>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Status</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Name</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>MAC Address</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Assigned Room</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Firmware</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((dev) => (
                    <TableRow
                      key={dev.id}
                      className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: 'var(--agni-border)' }}
                    >
                      {/* Status */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {dev.status === 'online' ? (
                            <Wifi className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <WifiOff className="w-4 h-4" style={{ color: 'var(--agni-text-muted)' }} />
                          )}
                          <StatusIndicator
                            status={dev.status === 'online' ? 'safe' : 'offline'}
                            size="sm"
                          />
                        </div>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <span className="font-medium text-sm" style={{ color: 'var(--agni-text-primary)' }}>
                          {dev.name}
                        </span>
                      </TableCell>

                      {/* MAC */}
                      <TableCell>
                        <span
                          className="text-xs font-mono px-2 py-1 rounded"
                          style={{
                            backgroundColor: 'var(--agni-bg-primary)',
                            color: 'var(--agni-text-secondary)',
                          }}
                        >
                          {dev.mac_address || '—'}
                        </span>
                      </TableCell>

                      {/* Room Assignment */}
                      <TableCell>
                        <RoomSelector
                          currentRoomId={dev.room_id}
                          onChange={(val) =>
                            handleDeviceRoomChange(dev.id, val)
                          }
                        />
                      </TableCell>

                      {/* Firmware */}
                      <TableCell>
                        <span
                          className="text-xs font-mono"
                          style={{ color: 'var(--agni-text-muted)' }}
                        >
                          {dev.firmware_version || '—'}
                        </span>
                      </TableCell>

                      {/* Last Seen */}
                      <TableCell>
                        <span
                          className="text-xs font-mono"
                          style={{ color: 'var(--agni-text-muted)' }}
                        >
                          {formatTime(dev.last_seen)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Camera Dialog */}
      <AddCameraDialog
        open={showAddCamera}
        onOpenChange={setShowAddCamera}
        rooms={rooms}
        onSuccess={fetchAll}
      />
    </div>
  );
}
