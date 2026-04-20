import Dexie, { type Table } from 'dexie';

// Das ist die Struktur für unsere gespeicherten Bilder/Videos/Events
export interface OfflineContent {
  id: number;
  fileName: string;
  blob: Blob;       // Die Datei selbst
  tabName: string;
  duration: string;
  title: string;
  content: string;
  docNumber: string;
  category: string;
  // --- NEU: DATUM & UHRZEIT FÜR EVENTS ---
  eventDate: string; 
  eventTime: string;
}

export class PlayerDatabase extends Dexie {
  content!: Table<OfflineContent>; 

  constructor() {
    super('CitySyncPlayerDB');
    
    // Version auf 3 erhöhen, da wir neue Felder hinzugefügt haben
    this.version(3).stores({
      content: 'id, tabName' 
    });
  }
}

export const db = new PlayerDatabase();