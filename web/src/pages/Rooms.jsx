import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoomCard from '@/components/dashboard/RoomCard';
import HoverClue from '@/components/ui/HoverClue';
import { useRoomsStore } from '@/stores/useRoomsStore';

export default function Rooms() {
  const { rooms, isLoading, fetchRooms } = useRoomsStore();

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const getCount = (status) => status === 'all' 
    ? rooms.length 
    : rooms.filter(r => r.status === status).length;

  if (isLoading && rooms.length === 0) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--agni-text-primary)' }}>Facility Rooms</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-36 rounded-md border animate-pulse" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center">
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--agni-text-primary)' }}>Facility Rooms</h1>
            <HoverClue text="Daftar seluruh ruangan. Pilih dan klik ruangan mana saja untuk melihat detail cctv dan data spesifik sensor dari ruangan tersebut." />
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--agni-text-muted)' }}>Monitor detailed status of all monitored areas.</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList 
          className="w-full justify-start h-auto p-1 mb-6" 
          style={{ backgroundColor: 'var(--agni-bg-secondary)', borderColor: 'var(--agni-border)', borderBottomWidth: '1px' }}
        >
          {['all', 'safe', 'warning', 'high', 'critical'].map(filter => (
            <TabsTrigger 
              key={filter} 
              value={filter}
              className="capitalize px-4 py-2 data-[state=active]:bg-[var(--agni-bg-tertiary)] data-[state=active]:text-[var(--agni-amber)]"
            >
              {filter}
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--agni-bg-primary)' }}>
                {getCount(filter)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {['all', 'safe', 'warning', 'high', 'critical'].map(filter => (
          <TabsContent key={filter} value={filter} className="mt-0 outline-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {rooms.filter(r => filter === 'all' || r.status === filter).map(room => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
            
            {getCount(filter) === 0 && (
              <div 
                className="flex flex-col items-center justify-center p-12 mt-8 rounded-lg border border-dashed"
                style={{ borderColor: 'var(--agni-border)' }}
              >
                <div className="w-12 h-12 mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--agni-bg-secondary)' }}>
                  <div className="w-2 h-2 rounded-full led-safe bg-[var(--agni-safe)]" />
                </div>
                <h3 className="text-[var(--agni-text-primary)] font-medium">No rooms found</h3>
                <p className="text-[var(--agni-text-muted)] text-sm text-center max-w-sm mt-1">
                  There are currently no rooms matching the &quot;{filter}&quot; status filter.
                </p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
