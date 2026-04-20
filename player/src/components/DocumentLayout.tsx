import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, FileText, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface DocumentLayoutProps {
  data: any[];
  tabTitle: string | null;
}

export const DocumentLayout = ({ data, tabTitle }: DocumentLayoutProps) => {
  const [collapsedDocs, setCollapsedDocs] = useState<{ [key: string]: boolean }>({});
  const [pageIndices, setPageIndices] = useState<{ [key: string]: number }>({});

  const groupedDocuments = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    data.forEach(item => {
      let rawTitle = item.title && item.title !== "null" ? item.title : (item.fileName?.split('.')[0] || "Dokument");
      const cleanTitle = rawTitle.replace(/\s*\(Seite\s*\d+\/\d+\)\s*$/i, "").trim();

      if (!groups[cleanTitle]) groups[cleanTitle] = [];
      groups[cleanTitle].push(item);
    });

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
    });

    return Object.entries(groups);
  }, [data]);

  return (
    <div style={{ 
      position: 'absolute', 
      inset: 0, 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: '#f8fafc' 
    }}>
      
      {/* SLIM HEADER */}
      <div style={{ 
        padding: '10px 20px', 
        backgroundColor: '#fff', 
        borderBottom: '1px solid #e2e8f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexShrink: 0, 
        zIndex: 10 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ backgroundColor: '#3A7D5E', padding: '6px', borderRadius: '6px', color: '#fff' }}>
            <FileText size={16} />
          </div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
             {tabTitle || 'Dokumente'}
          </h2>
        </div>
        <div style={{ backgroundColor: '#f1f5f9', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
           {groupedDocuments.length} {groupedDocuments.length === 1 ? 'Eintrag' : 'Einträge'}
        </div>
      </div>

      {/* DIE LISTE */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '12px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px',
        minHeight: 0 
      }}>
        
        {groupedDocuments.map(([title, pages]) => {
          const isCollapsed = collapsedDocs[title] ?? false;
          const currentPage = pageIndices[title] || 0;
          const activePage = pages[currentPage];

          return (
            <div key={title} style={{ 
              backgroundColor: '#fff', 
              borderRadius: '10px', 
              boxShadow: '0 2px 5px rgba(0,0,0,0.03)', 
              border: '1px solid #e2e8f0', 
              flexShrink: 0 
            }}>
              
              {/* COMPACT TITEL-ZEILE */}
              <div 
                onClick={() => setCollapsedDocs(p => ({ ...p, [title]: !isCollapsed }))}
                style={{ 
                  padding: '10px 15px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  backgroundColor: isCollapsed ? '#fff' : '#fcfcfc'
                }}
              >
                <div style={{ color: '#3A7D5E' }}><Info size={14} /></div>
                <div style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{title}</div>
                
                {pages.length > 1 && (
                  <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 800, marginRight: '5px', backgroundColor: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>
                    {currentPage + 1} / {pages.length}
                  </span>
                )}
                {isCollapsed ? <ChevronDown size={16} color="#94a3b8" /> : <ChevronUp size={16} color="#94a3b8" />}
              </div>

              {/* BILD-BEREICH: Kleiner (max 600px) */}
              {!isCollapsed && (
                <div style={{ 
                  padding: '10px', 
                  borderTop: '1px solid #f1f5f9', 
                  position: 'relative', 
                  display: 'flex', 
                  justifyContent: 'center',
                  backgroundColor: '#fff'
                }}>
                  
                  {pages.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setPageIndices(prev => ({...prev, [title]: (currentPage - 1 + pages.length) % pages.length})) }} style={navBtnStyle}>
                        <ChevronLeft size={20} color="#3A7D5E" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setPageIndices(prev => ({...prev, [title]: (currentPage + 1) % pages.length})) }} style={{ ...navBtnStyle, right: '10px', left: 'auto' }}>
                        <ChevronRight size={20} color="#3A7D5E" />
                      </button>
                    </>
                  )}

                  <div style={{ width: '100%', maxWidth: '500px' }}> {/* REDUZIERT AUF 600px */}
                    <img 
                      src={activePage.localUrl} 
                      style={{ 
                        width: '100%', 
                        height: 'auto', 
                        borderRadius: '2px', 
                        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                        display: 'block'
                      }} 
                      alt="Dokument" 
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        <div style={{ height: '20px', flexShrink: 0 }} />
      </div>
    </div>
  );
};

const navBtnStyle: React.CSSProperties = {
  position: 'absolute', 
  left: '10px', 
  top: '50%', 
  transform: 'translateY(-50%)',
  backgroundColor: 'rgba(255,255,255,0.9)', 
  border: '1px solid #e2e8f0', 
  borderRadius: '50%',
  width: '36px', 
  height: '36px', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  boxShadow: '0 2px 6px rgba(0,0,0,0.1)', 
  cursor: 'pointer', 
  zIndex: 5
};