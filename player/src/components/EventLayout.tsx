import React, { useMemo, useState } from 'react';
import { Calendar, Clock, Tag, X, Maximize2 } from 'lucide-react';

interface EventLayoutProps {
  data: any[];
  tabTitle: string | null;
}

export const EventLayout = ({ data, tabTitle }: EventLayoutProps) => {
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // 1. Sortierung & Validierung
  const sortedEvents = useMemo(() => {
    return [...data].sort((a, b) => {
      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 9999999999999;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 9999999999999;
      return dateA - dateB;
    });
  }, [data]);

  // Hilfsfunktionen für das Datum (mit Fallback)
  const getEventDateObj = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatDay = (dateStr: string) => {
    const d = getEventDateObj(dateStr);
    return d ? d.getDate() : '??';
  };

  const formatMonth = (dateStr: string) => {
    const d = getEventDateObj(dateStr);
    return d ? d.toLocaleDateString('de-DE', { month: 'short' }).toUpperCase() : '---';
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      
      {/* HEADER */}
      <div style={{ 
        padding: '10px 20px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#3A7D5E', padding: '6px', borderRadius: '6px', color: '#fff' }}>
            <Calendar size={16} />
          </div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
             {tabTitle || 'Events'}
          </h2>
        </div>
        <div style={{ backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
           {sortedEvents.length} Termine
        </div>
      </div>

      {/* EVENT LISTE */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sortedEvents.map((event) => (
          <div 
            key={event.id} 
            onClick={() => setSelectedEvent(event)} // Klick zum Vergrößern
            style={{ 
              backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', 
              display: 'flex', alignItems: 'stretch', cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'transform 0.1s'
            }}
          >
            {/* DATUMS-BOX */}
            <div style={{ 
              width: '65px', backgroundColor: '#fcfcfc', borderRight: '1px solid #eee',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 0'
            }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#D32F2F' }}>{formatMonth(event.eventDate)}</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b' }}>{formatDay(event.eventDate)}</div>
            </div>

            {/* INFO-BEREICH */}
            <div style={{ flex: 1, padding: '10px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                {event.title || "Veranstaltung"}
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {event.eventTime && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    <Clock size={13} color="#3A7D5E" /> {event.eventTime} Uhr
                  </div>
                )}
                {event.category && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    <Tag size={13} color="#3A7D5E" /> {event.category}
                  </div>
                )}
              </div>
            </div>

            {/* VORSCHAU-BILD */}
            {event.localUrl && (
              <div style={{ width: '90px', padding: '6px', position: 'relative' }}>
                <img src={event.localUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} alt="Flyer" />
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '4px', padding: '2px' }}>
                   <Maximize2 size={12} color="#fff" />
                </div>
              </div>
            )}
          </div>
        ))}
        <div style={{ height: '20px' }} />
      </div>

      {/* --- GROSSANSICHT / MODAL --- */}
      {selectedEvent && (
        <div 
          onClick={() => setSelectedEvent(null)}
          style={{ 
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', 
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px', animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={40} />
          </button>

          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <img 
              src={selectedEvent.localUrl} 
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
              alt="Flyer Groß" 
            />
            <div style={{ marginTop: '20px', textAlign: 'center', color: '#fff' }}>
               <h2 style={{ margin: 0, fontSize: '28px' }}>{selectedEvent.title}</h2>
               <p style={{ fontSize: '18px', opacity: 0.8 }}>
                 {new Date(selectedEvent.eventDate).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })} 
                 {selectedEvent.eventTime && ` | ${selectedEvent.eventTime} Uhr`}
               </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};