using Microsoft.Data.Sqlite;
using System.Diagnostics;
using System.Collections.Generic; // Wichtig für die Listen
using CitySync.Models;
namespace CitySyncApi
{
    public static class DatabaseMonitors
    {
        // Der Pfad zur Datenbank-Datei
        public static string ConnectionString = "Data Source=CitySync.db";

        public static void InitializeDatabase()
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();

                // 1. Tabelle für Standorte
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Locations (
                        Id TEXT PRIMARY KEY,
                        Name TEXT NOT NULL
                    );";
                command.ExecuteNonQuery();

                // 2. Tabelle für Monitore
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Monitors (
                        Id TEXT PRIMARY KEY,
                        LocationId TEXT NOT NULL,
                        Name TEXT NOT NULL,
                        IP TEXT NOT NULL,
                        Resolution TEXT NOT NULL,
                        Status TEXT DEFAULT 'online',
                        LayoutType TEXT DEFAULT 'fullscreen',
                        ButtonCount INTEGER DEFAULT 0,
                        ButtonNames TEXT,
                        ButtonTypes TEXT,
                        LastPublished DATETIME,
                        FOREIGN KEY (LocationId) REFERENCES Locations(Id) ON DELETE CASCADE
                    );";
                command.ExecuteNonQuery();

                // 3. Tabelle für Routines (Zeitpläne)
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Routines (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        MonitorId TEXT NOT NULL,
                        Days TEXT NOT NULL,
                        StartTime TEXT NOT NULL,
                        EndTime TEXT NOT NULL,
                        FOREIGN KEY (MonitorId) REFERENCES Monitors(Id) ON DELETE CASCADE
                    );";
                command.ExecuteNonQuery();
                
                // 4. Tabelle für Medien & Events
                // NEU: Hier haben wir Title, EventDate, EventTime, SortOrder UND IsLive direkt hinzugefügt!
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS ScreenMedia (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        MonitorId TEXT NOT NULL,
                        TabName TEXT NOT NULL,
                        FileName TEXT NOT NULL,
                        FileType TEXT NOT NULL,
                        Duration TEXT DEFAULT '15s',
                        UploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        ExpirationDate TEXT,
                        SortOrder INTEGER DEFAULT 0,
                        Title TEXT,
                        Content TEXT,
                        EventDate TEXT,
                        EventTime TEXT,
                        IsLive INTEGER DEFAULT 0, -- <--- HIER IST DIE NEUE SPALTE
                        DocNumber TEXT,
                        Category TEXT,
                        IsProtected INTEGER DEFAULT 0,
                        PinCode TEXT,
                        KeepInArchive INTEGER DEFAULT 0,
                        FOREIGN KEY (MonitorId) REFERENCES Monitors(Id) ON DELETE CASCADE
                    );";
                command.ExecuteNonQuery();
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS MediaArchive (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        OriginalMediaId INTEGER,
                        MonitorId TEXT NOT NULL,
                        Title TEXT NOT NULL,
                        DocNumber TEXT,
                        Category TEXT,
                        StartDate TEXT,
                        EndDate TEXT,
                        Url TEXT,
                        IsProtected INTEGER DEFAULT 0,
                        PinCode TEXT,
                        ArchivedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (MonitorId) REFERENCES Monitors(Id) ON DELETE CASCADE
                    );";
                command.ExecuteNonQuery();
                // 5. Tabelle für System-Einstellungen (Key-Value Store)
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS SystemSettings (
                        SettingKey TEXT PRIMARY KEY,
                        SettingValue TEXT NOT NULL
                    );";
                command.ExecuteNonQuery();

                // Standardwerte direkt in die Datenbank schreiben (falls sie noch leer ist)
                command.CommandText = @"
                    INSERT OR IGNORE INTO SystemSettings (SettingKey, SettingValue) VALUES ('Theme', 'dark');
                    INSERT OR IGNORE INTO SystemSettings (SettingKey, SettingValue) VALUES ('DefaultDuration', '12');
                    INSERT OR IGNORE INTO SystemSettings (SettingKey, SettingValue) VALUES ('AutoDeleteYears', '3');
                ";
                command.ExecuteNonQuery();

                    // 6. Tabelle für Rollen
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Roles (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        Name TEXT NOT NULL UNIQUE
                    );";
                command.ExecuteNonQuery();

                // 7. Tabelle für Berechtigungen (Permissions)
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Permissions (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        PermissionKey TEXT NOT NULL UNIQUE,
                        Description TEXT NOT NULL
                    );";
                command.ExecuteNonQuery();

                // 8. Verknüpfungstabelle (Welche Rolle hat welche Berechtigung?)
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS RolePermissions (
                        RoleId INTEGER NOT NULL,
                        PermissionId INTEGER NOT NULL,
                        PRIMARY KEY (RoleId, PermissionId),
                        FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE,
                        FOREIGN KEY (PermissionId) REFERENCES Permissions(Id) ON DELETE CASCADE
                    );";
                command.ExecuteNonQuery();

                // 9. Tabelle für Benutzer
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Users (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        Name TEXT NOT NULL,
                        Email TEXT NOT NULL UNIQUE,
                        PasswordHash TEXT NOT NULL,
                        RoleId INTEGER NOT NULL,
                        LastLogin DATETIME,
                        FOREIGN KEY (RoleId) REFERENCES Roles(Id)
                    );";
                command.ExecuteNonQuery();


                // --- STANDARDWERTE (SEEDING) ---
                
                command.CommandText = @"
                    INSERT OR IGNORE INTO SystemSettings (SettingKey, SettingValue) VALUES ('Theme', 'dark');
                    INSERT OR IGNORE INTO SystemSettings (SettingKey, SettingValue) VALUES ('DefaultDuration', '12');
                    INSERT OR IGNORE INTO SystemSettings (SettingKey, SettingValue) VALUES ('AutoDeleteYears', '3');
                    
                    -- Standard-Rollen anlegen
                    INSERT OR IGNORE INTO Roles (Id, Name) VALUES (1, 'Administrator');
                    INSERT OR IGNORE INTO Roles (Id, Name) VALUES (2, 'Redakteur');
                    INSERT OR IGNORE INTO Roles (Id, Name) VALUES (3, 'Techniker');

                    -- Standard-Berechtigungen anlegen
                    INSERT OR IGNORE INTO Permissions (Id, PermissionKey, Description) VALUES (1, 'screens.view', 'Monitore & Status sehen');
                    INSERT OR IGNORE INTO Permissions (Id, PermissionKey, Description) VALUES (2, 'screens.manage', 'Monitore hinzufügen/löschen');
                    INSERT OR IGNORE INTO Permissions (Id, PermissionKey, Description) VALUES (3, 'media.view', 'Inhalte ansehen');
                    INSERT OR IGNORE INTO Permissions (Id, PermissionKey, Description) VALUES (4, 'media.upload', 'Neues hochladen/schreiben');
                    INSERT OR IGNORE INTO Permissions (Id, PermissionKey, Description) VALUES (5, 'media.publish', 'Auf Monitoren Live schalten');
                    INSERT OR IGNORE INTO Permissions (Id, PermissionKey, Description) VALUES (6, 'media.delete', 'Inhalte endgültig löschen');
                    INSERT OR IGNORE INTO Permissions (Id, PermissionKey, Description) VALUES (7, 'users.manage', 'Benutzer verwalten');

                    -- Dem Admin (Role 1) alle Rechte geben
                    INSERT OR IGNORE INTO RolePermissions (RoleId, PermissionId) VALUES (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7);

                    -- Dem Redakteur (Role 2) nur Content-Rechte geben (1, 3, 4, 5, 6)
                    INSERT OR IGNORE INTO RolePermissions (RoleId, PermissionId) VALUES (2, 1), (2, 3), (2, 4), (2, 5), (2, 6);

                    -- Dem Techniker (Role 3) nur Hardware-Rechte geben (1, 2)
                    INSERT OR IGNORE INTO RolePermissions (RoleId, PermissionId) VALUES (3, 1), (3, 2);

                    -- Den ersten Super-Admin Benutzer anlegen (Passwort: 'admin123' - sollte später verschlüsselt sein!)
                    -- HINWEIS: Für den Start steht hier das Passwort im Klartext. Wenn wir das Login bauen, tauschen wir das gegen einen Hash aus.
                    INSERT OR IGNORE INTO Users (Id, Name, Email, PasswordHash, RoleId) 
                    VALUES (1, 'Super Admin', 'admin@citysync.at', 'admin123', 1);
                ";
                command.ExecuteNonQuery();
            }
            Debug.WriteLine("Datenbank erfolgreich initialisiert und mit RBAC geupdated.");

        }

        // --- STANDORT LOGIK ---
        public static void UpsertLocation(string id, string name)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                
                // Dieser Befehl rettet deine Monitore vor dem Löschen!
                command.CommandText = @"
                    INSERT INTO Locations (Id, Name) 
                    VALUES (@id, @name)
                    ON CONFLICT(Id) DO UPDATE SET Name = excluded.Name;";
                    
                command.Parameters.AddWithValue("@id", id);
                command.Parameters.AddWithValue("@name", name);
                command.ExecuteNonQuery();
            }
        }
        // --- MONITOR LOGIK ---
        public static void InsertMonitor(string id, string locationId, string name, string ip, string resolution)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = @"
                    INSERT INTO Monitors (Id, LocationId, Name, IP, Resolution) 
                    VALUES (@id, @locId, @name, @ip, @res);";
                command.Parameters.AddWithValue("@id", id);
                command.Parameters.AddWithValue("@locId", locationId);
                command.Parameters.AddWithValue("@name", name);
                command.Parameters.AddWithValue("@ip", ip);
                command.Parameters.AddWithValue("@res", resolution);
                command.ExecuteNonQuery();
            }
        }

        public static void UpdateMonitor(string id, string newName, string newIp, string newRes)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "UPDATE Monitors SET Name = @name, IP = @ip, Resolution = @res WHERE Id = @id;";
                command.Parameters.AddWithValue("@name", newName);
                command.Parameters.AddWithValue("@ip", newIp);
                command.Parameters.AddWithValue("@res", newRes);
                command.Parameters.AddWithValue("@id", id);
                command.ExecuteNonQuery();
            }
        }

        public static void DeleteMonitor(string id)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "DELETE FROM Monitors WHERE Id = @id;";
                command.Parameters.AddWithValue("@id", id);
                command.ExecuteNonQuery();
            }
        }
        public static string DeleteMedia(int id)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                
                // 1. Dateinamen holen, bevor wir den Datensatz löschen
                string fileName = "";
                var getCmd = connection.CreateCommand();
                getCmd.CommandText = "SELECT FileName FROM ScreenMedia WHERE Id = @id";
                getCmd.Parameters.AddWithValue("@id", id);
                using (var reader = getCmd.ExecuteReader()) {
                    if (reader.Read()) fileName = reader.GetString(0);
                }

                // 2. Aus Datenbank löschen
                var delCmd = connection.CreateCommand();
                delCmd.CommandText = "DELETE FROM ScreenMedia WHERE Id = @id";
                delCmd.Parameters.AddWithValue("@id", id);
                delCmd.ExecuteNonQuery();

                return fileName; // Wir geben den Namen zurück, damit der Controller die Datei löschen kann
            }
        }

        // --- KOMPLEXE ABFRAGE FÜR REACT ---
        public static List<object> GetDashboardData()
        {
            var result = new List<object>();

            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                
                var locCommand = connection.CreateCommand();
                locCommand.CommandText = "SELECT Id, Name FROM Locations;";
                
                using (var locReader = locCommand.ExecuteReader())
                {
                    while (locReader.Read())
                    {
                        string locId = locReader.GetString(0);
                        string locName = locReader.GetString(1);
                        var screens = new List<object>();

                        var monCommand = connection.CreateCommand();
                        monCommand.CommandText = "SELECT Id, Name, IP, Resolution, Status, LayoutType, ButtonCount, ButtonNames, ButtonTypes FROM Monitors WHERE LocationId = @locId;";
                        monCommand.Parameters.AddWithValue("@locId", locId);

                        using (var monReader = monCommand.ExecuteReader())
                        {
                            while (monReader.Read())
                            {
                                string monitorId = monReader.GetString(0);

                                // NEU PRO-VERSION: Wir holen ALLE Routinen als Liste
                                var routinesList = new List<object>();
                                var rCmd = connection.CreateCommand();
                                rCmd.CommandText = "SELECT Id, Days, StartTime, EndTime FROM Routines WHERE MonitorId = @mId;";
                                rCmd.Parameters.AddWithValue("@mId", monitorId);
                                
                                using (var rReader = rCmd.ExecuteReader())
                                {
                                    while (rReader.Read())
                                    {
                                        routinesList.Add(new {
                                            id = rReader.GetInt32(0),
                                            days = rReader.GetString(1),
                                            startTime = rReader.GetString(2),
                                            endTime = rReader.GetString(3)
                                        });
                                    }
                                }

                                // =========================================================
                                // NEU: VORSCHAU-BILD ABRUFEN
                                // =========================================================
                                string previewUrl = null;
                                using (var pCmd = connection.CreateCommand())
                                {
                                    // Wir holen FileName UND FileType vom ERSTEN Live-Eintrag
                                    pCmd.CommandText = @"
                                        SELECT FileName, FileType 
                                        FROM ScreenMedia 
                                        WHERE MonitorId = @mId 
                                        AND IsLive = 1 
                                        AND TabName = 'Allgemein' 
                                        ORDER BY SortOrder ASC, Id ASC 
                                        LIMIT 1;";
                                    pCmd.Parameters.AddWithValue("@mId", monitorId);
                                    
                                    using (var pReader = pCmd.ExecuteReader())
                                    {
                                        if (pReader.Read())
                                        {
                                            string fName = pReader.GetString(0);
                                            string fType = pReader.GetString(1);

                                            if (fType == "video")
                                            {
                                                // Bei Videos: Das _thumb.jpg laden statt der mp4-Datei!
                                                string thumbName = System.IO.Path.GetFileNameWithoutExtension(fName) + "_thumb.jpg";
                                                previewUrl = "/uploads/" + thumbName;
                                            }
                                            else
                                            {
                                                // Bei Bildern und PDFs (die ja JPGs sind)
                                                previewUrl = "/uploads/" + fName;
                                            }
                                        }
                                    }
                                }
                                // =========================================================

                                screens.Add(new {
                                    id = monitorId,
                                    name = monReader.GetString(1),
                                    ip = monReader.GetString(2),
                                    resolution = monReader.GetString(3),
                                    status = monReader.GetString(4),
                                    layoutType = monReader.IsDBNull(5) ? "sidebar" : monReader.GetString(5),
                                    buttonCount = monReader.IsDBNull(6) ? 0 : monReader.GetInt32(6),
                                    buttonNames = monReader.IsDBNull(7) ? "" : monReader.GetString(7),
                                    buttonTypes = monReader.IsDBNull(8) ? "" : monReader.GetString(8),
                                    previewUrl = previewUrl, // <--- HIER WIRD ES AN DAS FRONTEND ÜBERGEBEN!
                                    routines = routinesList 
                                });
                            }
                        }

                        result.Add(new {
                            id = locId,
                            name = locName,
                            screens = screens
                        });
                    }
                }
            }
            return result;
        }

        // --- ROUTINEN LOGIK (PRO-VERSION: SCHEDULE) ---
        
        // Speichert eine NEUE Routine dazu (kein Überschreiben mehr!)
        public static void SaveRoutine(string monitorId, string days, string startTime, string endTime)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                
                // Wir zerteilen den String (z.B. "Mi,Do,Fr") in eine Liste
                var dayArray = days.Split(','); 
                
                foreach (var day in dayArray)
                {
                    // 1. Falls es für diesen Monitor an DIESEM Tag schon eine Regel gibt -> Löschen!
                    var delCmd = connection.CreateCommand();
                    delCmd.CommandText = "DELETE FROM Routines WHERE MonitorId = @mId AND Days = @day;";
                    delCmd.Parameters.AddWithValue("@mId", monitorId);
                    delCmd.Parameters.AddWithValue("@day", day);
                    delCmd.ExecuteNonQuery();

                    // 2. Die neue Regel für diesen EINEN Tag speichern
                    var insertCmd = connection.CreateCommand();
                    insertCmd.CommandText = @"
                        INSERT INTO Routines (MonitorId, Days, StartTime, EndTime) 
                        VALUES (@mId, @day, @start, @end);";
                    insertCmd.Parameters.AddWithValue("@mId", monitorId);
                    insertCmd.Parameters.AddWithValue("@day", day); // Hier steht jetzt immer nur exakt ein Tag (z.B. "Mi")
                    insertCmd.Parameters.AddWithValue("@start", startTime);
                    insertCmd.Parameters.AddWithValue("@end", endTime);
                    insertCmd.ExecuteNonQuery();
                }
            }
        }

        // Holt ALLE Routinen für einen bestimmten Monitor
        public static List<object> GetRoutines(string monitorId)
        {
            var list = new List<object>();
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "SELECT Id, Days, StartTime, EndTime FROM Routines WHERE MonitorId = @mId;";
                command.Parameters.AddWithValue("@mId", monitorId);

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new {
                            id = reader.GetInt32(0), // Eindeutige ID der Routine
                            days = reader.GetString(1).Split(','), 
                            startTime = reader.GetString(2),
                            endTime = reader.GetString(3)
                        });
                    }
                }
            }
            return list;
        }

        // Löscht nur EINE spezifische Routine anhand ihrer ID
        public static void DeleteRoutine(int routineId)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "DELETE FROM Routines WHERE Id = @rId;";
                command.Parameters.AddWithValue("@rId", routineId);
                command.ExecuteNonQuery();
            }
        }

        public static void SaveScreenConfig(string id, string layoutType, int buttonCount, string buttonNames, string buttonTypes)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = @"
                    UPDATE Monitors 
                    SET LayoutType = @layout, 
                        ButtonCount = @count, 
                        ButtonNames = @names,
                        ButtonTypes = @types  -- NEUE SPALTE
                    WHERE Id = @id;";
                
                command.Parameters.AddWithValue("@layout", layoutType);
                command.Parameters.AddWithValue("@count", buttonCount);
                command.Parameters.AddWithValue("@names", buttonNames); // z.B. "News,Wetter,Infos"
                command.Parameters.AddWithValue("@types", buttonTypes); // z.B. "news,event,document"
                command.Parameters.AddWithValue("@id", id);
                
                command.ExecuteNonQuery();
            }
        }
        
        // --- LIVE SCHALTEN (PUBLISH) ---
        public static void PublishMonitor(string id)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                
                // 1. Sicherheitshalber: Wir versuchen die Spalte anzulegen (falls sie noch nicht existiert)
                try {
                    var altCmd = connection.CreateCommand();
                    altCmd.CommandText = "ALTER TABLE Monitors ADD COLUMN LastPublished DATETIME;";
                    altCmd.ExecuteNonQuery();
                } catch { /* Ignorieren, falls die Spalte schon da ist */ }

                // 2. Wir setzen den aktuellen Zeitstempel
                var command = connection.CreateCommand();
                command.CommandText = "UPDATE Monitors SET LastPublished = CURRENT_TIMESTAMP WHERE Id = @id;";
                command.Parameters.AddWithValue("@id", id);
                command.ExecuteNonQuery();
            }
        }
        public static List<object> GetMediaForMonitor(string monitorId)
        {
            var list = new List<object>();
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                // --- NEU: DER HAUSMEISTER (Auto-Delete) ---
                // Löscht alle Events (die ein EventDate haben), deren Startzeitpunkt mehr als 24 Stunden her ist.
                try {
                    var cleanCmd = connection.CreateCommand();
                    cleanCmd.CommandText = @"
                        DELETE FROM ScreenMedia 
                        WHERE EventDate IS NOT NULL 
                        AND EventDate != '' 
                        AND datetime(EventDate || 'T' || IFNULL(EventTime, '00:00') || ':00') < datetime('now', 'localtime', '-1 day');
                    ";
                    cleanCmd.ExecuteNonQuery();
                } catch { /* Falls das Datumsformat bei einem alten Eintrag kaputt ist, ignorieren wir es */ }

                // 1. Auto-Reparatur: Spalte 'SortOrder' hinzufügen, falls sie fehlt!
                try {
                    var altCmd = connection.CreateCommand();
                    altCmd.CommandText = "ALTER TABLE ScreenMedia ADD COLUMN SortOrder INTEGER DEFAULT 0;";
                    altCmd.ExecuteNonQuery();
                } catch { /* Ignorieren */ }

                var command = connection.CreateCommand();
                command.CommandText = "SELECT Id, TabName, FileName, FileType, Duration, UploadedAt, ExpirationDate, SortOrder, Title, EventDate, EventTime, IsLive, Content, DocNumber, Category, IsProtected, PinCode FROM ScreenMedia WHERE MonitorId = @mId ORDER BY SortOrder ASC, Id ASC;";
                command.Parameters.AddWithValue("@mId", monitorId);

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new {
                            id = reader.GetInt32(0),
                            tabName = reader.GetString(1),
                            fileName = reader.GetString(2),
                            fileType = reader.GetString(3),
                            duration = reader.GetString(4),
                            uploadDate = reader.IsDBNull(5) ? "Heute" : reader.GetDateTime(5).ToString("dd.MM. (HH:mm)"),
                            expirationDate = reader.IsDBNull(6) ? "Immer" : reader.GetString(6),
                            title = reader.IsDBNull(8) ? "" : reader.GetString(8),
                            eventDate = reader.IsDBNull(9) ? "" : reader.GetString(9),
                            eventTime = reader.IsDBNull(10) ? "" : reader.GetString(10),
                            isLive = reader.IsDBNull(11) ? 0 : reader.GetInt32(11),
                            content = reader.IsDBNull(12) ? "" : reader.GetString(12),
                            // --- NEUE FELDER AUSLESEN ---
                            docNumber = reader.IsDBNull(13) ? "" : reader.GetString(13),
                            category = reader.IsDBNull(14) ? "" : reader.GetString(14),
                            isProtected = reader.IsDBNull(15) ? 0 : reader.GetInt32(15),
                            pinCode = reader.IsDBNull(16) ? "" : reader.GetString(16)
                        });
                    }
                }
            }
            return list;
        }
        // --- ABLAUFDATUM SETZEN ---
        public static void SetExpirationDate(int id, string expirationDate)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var cmd = connection.CreateCommand();
                cmd.CommandText = "UPDATE ScreenMedia SET ExpirationDate = @exp WHERE Id = @id";
                cmd.Parameters.AddWithValue("@id", id);
                cmd.Parameters.AddWithValue("@exp", expirationDate);
                cmd.ExecuteNonQuery();
            }
        }
        // --- REIHENFOLGE SPEICHERN ---
        public static void UpdateMediaOrder(List<int> orderedIds)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                
                // Wir nutzen eine "Transaction" – das ist extrem schnell, weil es alle Updates in einem Rutsch in die DB schreibt
                using (var transaction = connection.BeginTransaction())
                {
                    var cmd = connection.CreateCommand();
                    cmd.CommandText = "UPDATE ScreenMedia SET SortOrder = @order WHERE Id = @id";
                    
                    var idParam = cmd.Parameters.Add("@id", Microsoft.Data.Sqlite.SqliteType.Integer);
                    var orderParam = cmd.Parameters.Add("@order", Microsoft.Data.Sqlite.SqliteType.Integer);

                    // Wir gehen die Liste durch und weisen jedem Bild seinen neuen Platz (0, 1, 2, 3...) zu
                    for (int i = 0; i < orderedIds.Count; i++)
                    {
                        idParam.Value = orderedIds[i];
                        orderParam.Value = i;
                        cmd.ExecuteNonQuery();
                    }
                    transaction.Commit();
                }
            }
        }
        // --- NEU: Medien & Events in die Datenbank speichern ---
        public static void AddMediaToMonitor(string monitorId, string tabName, string fileName, string fileType, string duration, string title = null, string content = null, string eventDate = null, string eventTime = null, string expirationDate = null, string docNumber = null, string category = null, int isProtected = 0, string pinCode = null, int keepInArchive = 0)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                
                command.CommandText = @"
                    INSERT INTO ScreenMedia (MonitorId, TabName, FileName, FileType, Duration, Title, Content, EventDate, EventTime, ExpirationDate, IsLive, DocNumber, Category, IsProtected, PinCode, KeepInArchive) 
                    VALUES (@mId, @tab, @file, @type, @dur, @title, @content, @eventDate, @eventTime, @exp, 0, @doc, @cat, @prot, @pin, @keepinarch);
                ";
                
                command.Parameters.AddWithValue("@mId", monitorId);
                command.Parameters.AddWithValue("@tab", tabName);
                command.Parameters.AddWithValue("@file", fileName);
                command.Parameters.AddWithValue("@type", fileType);
                command.Parameters.AddWithValue("@dur", duration);
                command.Parameters.AddWithValue("@title", title ?? "");
                command.Parameters.AddWithValue("@content", content ?? ""); 
                command.Parameters.AddWithValue("@eventDate", eventDate ?? "");
                command.Parameters.AddWithValue("@eventTime", eventTime ?? "");
                command.Parameters.AddWithValue("@exp", expirationDate ?? "Immer"); 
                // NEU:
                command.Parameters.AddWithValue("@doc", docNumber ?? "");
                command.Parameters.AddWithValue("@cat", category ?? "");
                command.Parameters.AddWithValue("@prot", isProtected);
                command.Parameters.AddWithValue("@pin", pinCode ?? "");
                command.Parameters.AddWithValue("@keepinarch", keepInArchive);

                command.ExecuteNonQuery();
            }
        }
       // --- NEU: Universelle Update-Funktion (Für News & Events) ---
        // --- Diese Methode muss jetzt 10 Parameter annehmen ---
public static void UpdateMediaData(
    int id, 
    string title, 
    string content, 
    string eventDate, 
    string eventTime, 
    string expirationDate, 
    string docNumber = null, 
    string category = null, 
    int isProtected = 0, 
    string pinCode = null,
    int keepInArchive = 0)
{
    using (var connection = new SqliteConnection(ConnectionString))
    {
        connection.Open();
        var command = connection.CreateCommand();
        
        // Wir erweitern das SQL UPDATE um die neuen Spalten für Dokumente
        command.CommandText = @"
            UPDATE ScreenMedia 
            SET Title = @title, 
                Content = @content, 
                EventDate = @eventDate, 
                EventTime = @eventTime, 
                ExpirationDate = @exp,
                DocNumber = @doc,
                Category = @cat,
                IsProtected = @prot,
                PinCode = @pin
                KeepInArchive = @keepinarch
            WHERE Id = @id;
        ";
        
        command.Parameters.AddWithValue("@title", title ?? "");
        command.Parameters.AddWithValue("@content", content ?? "");
        command.Parameters.AddWithValue("@eventDate", eventDate ?? "");
        command.Parameters.AddWithValue("@eventTime", eventTime ?? "");
        command.Parameters.AddWithValue("@exp", expirationDate ?? "Immer");
        
        // Die neuen Parameter für Dokumente:
        command.Parameters.AddWithValue("@doc", docNumber ?? "");
        command.Parameters.AddWithValue("@cat", category ?? "");
        command.Parameters.AddWithValue("@prot", isProtected);
        command.Parameters.AddWithValue("@pin", pinCode ?? "");
        
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@keepinarch", keepInArchive);

        command.ExecuteNonQuery();
    }
}
        // --- NEU: Einzelnes Medium auf "Live" (1) oder "Entwurf" (0) setzen ---
        public static void SetMediaLiveStatus(int id, int status)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var cmd = connection.CreateCommand();
                cmd.CommandText = "UPDATE ScreenMedia SET IsLive = @status WHERE Id = @id";
                cmd.Parameters.AddWithValue("@status", status);
                cmd.Parameters.AddWithValue("@id", id);
                cmd.ExecuteNonQuery();
            }
        }

        // --- NEU: ALLE Medien eines Monitors auf "Live" setzen ---
        public static void PublishAllMediaForMonitor(string monitorId, string tabName)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var cmd = connection.CreateCommand();
                
                // HIER IST DER FIX: Wir filtern zusätzlich nach dem TabName!
                cmd.CommandText = "UPDATE ScreenMedia SET IsLive = 1 WHERE MonitorId = @mId AND TabName = @tab";
                
                cmd.Parameters.AddWithValue("@mId", monitorId);
                cmd.Parameters.AddWithValue("@tab", tabName); // Den TabNamen übergeben
                
                cmd.ExecuteNonQuery();
                
                // Wir aktualisieren auch gleich den globalen Zeitstempel des Monitors!
                PublishMonitor(monitorId); 
            }
        }
        
        public static List<MediaArchiveItem> GetArchivedMediaForMonitor(string monitorId)
        {
            var archiveList = new List<MediaArchiveItem>();

            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                
                command.CommandText = "SELECT * FROM MediaArchive WHERE MonitorId = @MonitorId ORDER BY ArchivedAt DESC";
                command.Parameters.AddWithValue("@MonitorId", monitorId);

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        archiveList.Add(new MediaArchiveItem 
                        {
                            Id = Convert.ToInt32(reader["Id"]),
                            OriginalMediaId = reader["OriginalMediaId"] != DBNull.Value ? Convert.ToInt32(reader["OriginalMediaId"]) : 0,
                            MonitorId = reader["MonitorId"].ToString(),
                            Title = reader["Title"].ToString(),
                            DocNumber = reader["DocNumber"] != DBNull.Value ? reader["DocNumber"].ToString() : "",
                            Category = reader["Category"] != DBNull.Value ? reader["Category"].ToString() : "",
                            StartDate = reader["StartDate"] != DBNull.Value ? reader["StartDate"].ToString() : "",
                            EndDate = reader["EndDate"] != DBNull.Value ? reader["EndDate"].ToString() : "",
                            Url = reader["Url"] != DBNull.Value ? reader["Url"].ToString() : "",
                            IsProtected = reader["IsProtected"] != DBNull.Value ? Convert.ToInt32(reader["IsProtected"]) : 0,
                            PinCode = reader["PinCode"] != DBNull.Value ? reader["PinCode"].ToString() : "",
                            ArchivedAt = reader["ArchivedAt"] != DBNull.Value ? Convert.ToDateTime(reader["ArchivedAt"]) : DateTime.Now
                        });
                    }
                }
            }
            return archiveList;
        }
        public static List<MediaArchiveItem> GetAllArchivedMedia()
        {
            var archiveList = new List<MediaArchiveItem>();

            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                
                command.CommandText = "SELECT * FROM MediaArchive ORDER BY ArchivedAt DESC";
                

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        archiveList.Add(new MediaArchiveItem 
                        {
                            Id = Convert.ToInt32(reader["Id"]),
                            OriginalMediaId = reader["OriginalMediaId"] != DBNull.Value ? Convert.ToInt32(reader["OriginalMediaId"]) : 0,
                            MonitorId = reader["MonitorId"].ToString(),
                            Title = reader["Title"].ToString(),
                            DocNumber = reader["DocNumber"] != DBNull.Value ? reader["DocNumber"].ToString() : "",
                            Category = reader["Category"] != DBNull.Value ? reader["Category"].ToString() : "",
                            StartDate = reader["StartDate"] != DBNull.Value ? reader["StartDate"].ToString() : "",
                            EndDate = reader["EndDate"] != DBNull.Value ? reader["EndDate"].ToString() : "",
                            Url = reader["Url"] != DBNull.Value ? reader["Url"].ToString() : "",
                            IsProtected = reader["IsProtected"] != DBNull.Value ? Convert.ToInt32(reader["IsProtected"]) : 0,
                            PinCode = reader["PinCode"] != DBNull.Value ? reader["PinCode"].ToString() : "",
                            ArchivedAt = reader["ArchivedAt"] != DBNull.Value ? Convert.ToDateTime(reader["ArchivedAt"]) : DateTime.Now
                        });
                    }
                }
            }
            return archiveList;
        }

        public static string MoveMediaToArchive(int id)
        {
            using (var connection = new SqliteConnection(ConnectionString))
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction()) 
                {
                    try
                    {
                        var command = connection.CreateCommand();
                        command.Transaction = transaction;

                        // 1. Kopieren, wenn KeepInArchive = 1
                        command.CommandText = @"
                            INSERT INTO MediaArchive (OriginalMediaId, MonitorId, Title, DocNumber, Category, StartDate, EndDate, Url, IsProtected, PinCode)
                            SELECT Id, MonitorId, Title, DocNumber, Category, UploadedAt, ExpirationDate, '/' || TabName || '/' || FileName, IsProtected, PinCode
                            FROM ScreenMedia 
                            WHERE Id = @Id AND KeepInArchive = 1;";
                        command.Parameters.AddWithValue("@Id", id);
                        int rowsInserted = command.ExecuteNonQuery();

                        // 2. Aus der Live-Tabelle löschen
                        command.CommandText = "DELETE FROM ScreenMedia WHERE Id = @Id;";
                        command.ExecuteNonQuery();

                        transaction.Commit(); 

                        return rowsInserted > 0 ? "Ins Archiv verschoben!" : "Gelöscht (war nicht für Archiv markiert).";
                    }
                    catch (Exception ex)
                    {
                        transaction.Rollback();
                        throw new Exception("Fehler beim Archivieren: " + ex.Message);
                    }
                }
            }
        }
    }
}