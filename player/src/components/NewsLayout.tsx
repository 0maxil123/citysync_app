import React, { useState } from 'react';
import { Newspaper, Clock, ChevronRight, X, BookOpen } from 'lucide-react';

interface NewsLayoutProps {
  data: any[];
  tabTitle: string | null;
}

export const NewsLayout = ({ data, tabTitle }: NewsLayoutProps) => {
  const [selectedNews, setSelectedNews] = useState<any | null>(null);

  // Sortierung: Neueste zuerst (nach ID oder UploadDate)
  const sortedNews = [...data].sort((a, b) => b.id - a.id);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' }}>
      
      {/* SLIM HEADER */}
      <div style={{ 
        padding: '10px 20px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#3A7D5E', padding: '6px', borderRadius: '6px', color: '#fff' }}>
            <Newspaper size={16} />
          </div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
             {tabTitle || 'Aktuelles'}
          </h2>
        </div>
      </div>

      {/* NEWS LISTE */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sortedNews.map((item) => (
          <div 
            key={item.id} 
            onClick={() => setSelectedNews(item)}
            style={{ 
              backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', 
              display: 'flex', overflow: 'hidden', cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)', height: '100px'
            }}
          >
            {/* BILD LINKS */}
            {item.localUrl && (
              <div style={{ width: '150px', flexShrink: 0, backgroundColor: '#eee' }}>
                <img src={item.localUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="News" />
              </div>
            )}

            {/* CONTENT RECHTS */}
            <div style={{ flex: 1, padding: '12px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#3A7D5E', fontWeight: 700, textTransform: 'uppercase' }}>
                {item.category || 'Allgemein'}
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ color: '#64748b' }}>{item.uploadDate || 'Heute'}</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.title}
              </div>
            </div>

            <div style={{ width: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f1f5f9' }}>
               <ChevronRight size={20} color="#cbd5e1" />
            </div>
          </div>
        ))}
        <div style={{ height: '20px' }} />
      </div>

      {/* --- DETAIL MODAL --- */}
      {selectedNews && (
  <div 
    onClick={() => setSelectedNews(null)}
    style={{ 
      position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', // Dunkleres Blau-Grau für mehr Fokus
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'fadeIn 0.2s ease-out'
    }}
  >
    <div 
      onClick={(e) => e.stopPropagation()} 
      style={{ 
        backgroundColor: '#fff', width: '100%', maxWidth: '800px', maxHeight: '90vh', 
        borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* MODAL HEADER BILD */}
      <div style={{ width: '100%', height: '350px', position: 'relative', flexShrink: 0 }}>
        <img 
          src={selectedNews.localUrl} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          alt="News Detail" 
        />
        
        {/* DER NEUE PREMIUM X-BUTTON */}
        <button 
          onClick={() => setSelectedNews(null)}
          style={{ 
            position: 'absolute', 
            top: '20px', 
            right: '20px', 
            backgroundColor: '#fff', // Weißer Hintergrund für maximalen Kontrast
            color: '#3A7D5E',        // Deine Hausfarbe für das X
            border: 'none', 
            borderRadius: '50%', 
            width: '45px', 
            height: '45px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <X size={28} strokeWidth={2.5} />
        </button>

        {/* Sanfter Schatten-Verlauf über dem Bild unten */}
        <div style={{ 
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' 
        }} />
      </div>

      {/* MODAL TEXT CONTENT */}
      <div style={{ padding: '30px', overflowY: 'auto', backgroundColor: '#fff' }}>
        <div style={{ 
          color: '#3A7D5E', fontWeight: 800, fontSize: '13px', 
          marginBottom: '10px', letterSpacing: '1px', textTransform: 'uppercase' 
        }}>
          {selectedNews.category || 'News der Gemeinde'}
        </div>
        
        <h2 style={{ 
          fontSize: '32px', fontWeight: 800, margin: '0 0 15px 0', 
          color: '#1e293b', lineHeight: '1.2', letterSpacing: '-0.5px' 
        }}>
          {selectedNews.title}
        </h2>

        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '20px', 
          marginBottom: '25px', color: '#64748b', fontSize: '14px',
          paddingBottom: '20px', borderBottom: '1px solid #f1f5f9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={16} color="#3A7D5E" /> {selectedNews.uploadDate || 'Aktuell'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} color="#3A7D5E" /> Lesezeit: 2 Min.
          </div>
        </div>

        <div style={{ 
          fontSize: '19px', lineHeight: '1.7', color: '#334155', whiteSpace: 'pre-wrap',
          fontFamily: 'Georgia, serif'
        }}>
          {selectedNews.content || "Hier gibt es aktuell keine weiteren Details."}
        </div>
        
        {/* Abschluss-Element */}
        <div style={{ height: '20px' }} />
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