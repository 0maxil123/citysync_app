using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.Threading.Tasks;
using PdfiumViewer;
using System.Drawing.Imaging;
using System.Collections.Generic;
using Xabe.FFmpeg;

namespace CitySyncApi.Controllers
{
    [ApiController]
    [Route("api/media")]
    public class MediaController : ControllerBase
    {
        [HttpPost("upload")]
        public async Task<IActionResult> UploadMedia(
            [FromForm] IFormFile file, 
            [FromForm] string monitorId, 
            [FromForm] string tabName, 
            [FromForm] string duration, 
            [FromForm] string title = null,
            [FromForm] string content = null,
            [FromForm] string expirationDate = null, 
            [FromForm] string eventDate = null, 
            [FromForm] string eventTime = null,
            [FromForm] string docNumber = null,
            [FromForm] string category = null,
            [FromForm] int isProtected = 0,
            [FromForm] string pinCode = null,
            [FromForm] int keepInArchive = 0)
        {
            if (file == null || file.Length == 0) return BadRequest("Keine Datei hochgeladen.");

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var generatedUrls = new List<string>();
            string thumbnailUrl = null;

            // --- A) PDF LOGIK (Falls doch mal ein rohes PDF kommt) ---
            if (file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) || file.ContentType == "application/pdf")
            {
                using (var memoryStream = new MemoryStream())
                {
                    await file.CopyToAsync(memoryStream);
                    memoryStream.Position = 0; 

                    using (var document = PdfDocument.Load(memoryStream))
                    {
                        for (int i = 0; i < document.PageCount; i++)
                        {
                            var imageName = $"{Path.GetFileNameWithoutExtension(file.FileName)}_seite{i + 1}.jpg";
                            var imagePath = Path.Combine(uploadsFolder, imageName);
                            
                            using (var image = document.Render(i, 150, 150, PdfRenderFlags.CorrectFromDpi))
                            {
                                image.Save(imagePath, ImageFormat.Jpeg);
                            }

                            DatabaseMonitors.AddMediaToMonitor(
                                monitorId, tabName, imageName, "image", duration, 
                                title, content, eventDate, eventTime, expirationDate,
                                docNumber, category, isProtected, pinCode, keepInArchive
                            );
                            generatedUrls.Add($"/uploads/{imageName}");
                        }
                    }
                }
            }
            // --- B) VIDEO LOGIK ---
            else if (file.ContentType.StartsWith("video"))
            {
                var videoName = $"{Guid.NewGuid().ToString().Substring(0, 5)}_{file.FileName}";
                var videoPath = Path.Combine(uploadsFolder, videoName);
                var thumbName = Path.GetFileNameWithoutExtension(videoName) + "_thumb.jpg";
                var thumbPath = Path.Combine(uploadsFolder, thumbName);

                using (var stream = new FileStream(videoPath, FileMode.Create)) { await file.CopyToAsync(stream); }

                var conversion = await FFmpeg.Conversions.New().AddParameter($"-i \"{videoPath}\" -ss 00:00:01 -vframes 1 -q:v 2 \"{thumbPath}\"").Start();

                // FIX: Hier fehlten die Parameter!
                DatabaseMonitors.AddMediaToMonitor(
                    monitorId, tabName, videoName, "video", duration, 
                    title, content, eventDate, eventTime, expirationDate,
                    docNumber, category, isProtected, pinCode
                );
                generatedUrls.Add($"/uploads/{videoName}");
                thumbnailUrl = $"/uploads/{thumbName}";
            }
            // --- C) NORMALE BILDER LOGIK (Hier landet dein DocumentEditor!) ---
            else 
            {
                var uniqueFileName = $"{Guid.NewGuid().ToString().Substring(0, 5)}_{file.FileName}";
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);
                using (var stream = new FileStream(filePath, FileMode.Create)) { await file.CopyToAsync(stream); }
                
                // FIX: Hier wurden alle neuen Felder ignoriert - jetzt sind sie drin!
                DatabaseMonitors.AddMediaToMonitor(
                    monitorId, tabName, uniqueFileName, "image", duration, 
                    title, content, eventDate, eventTime, expirationDate,
                    docNumber, category, isProtected, pinCode
                );
                generatedUrls.Add($"/uploads/{uniqueFileName}");
            }

            return Ok(new { urls = generatedUrls, thumbnailUrl = thumbnailUrl });
        }

        // --- HILFSKLASSE FÜR UPDATES (Erweitert um Dokumenten-Felder) ---
        public class UpdateMediaRequest 
        {
            public string Title { get; set; }
            public string Content { get; set; }
            public string ExpirationDate { get; set; }
            public string EventDate { get; set; }
            public string EventTime { get; set; }
            public string DocNumber { get; set; } // NEU
            public string Category { get; set; }  // NEU
            public int IsProtected { get; set; }  // NEU
            public string PinCode { get; set; }    // NEU
            public int KeepInArchive { get; set; }
        }

        [HttpPut("update/{id}")]
        public IActionResult UpdateMediaItem(int id, [FromBody] UpdateMediaRequest req)
        {
            try {
                // Wir nutzen die universelle Update-Funktion
                DatabaseMonitors.UpdateMediaData(
                    id, req.Title, req.Content, req.EventDate, req.EventTime, 
                    req.ExpirationDate, req.DocNumber, req.Category, req.IsProtected, req.PinCode, req.KeepInArchive
                );
                return Ok(new { message = "Erfolgreich aktualisiert" });
            } catch (Exception ex) {
                return BadRequest(ex.Message);
            }
        }

        // --- RESTLICHE METHODEN (Delete, Get, Reorder) ---
        [HttpGet("{monitorId}")]
        public IActionResult GetMedia(string monitorId)
        {
            try {
                var mediaList = DatabaseMonitors.GetMediaForMonitor(monitorId);
                return Ok(mediaList);
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}")]
        public IActionResult DeleteMedia(int id)
        {
            try {
                string fileName = DatabaseMonitors.DeleteMedia(id);
                if (!string.IsNullOrEmpty(fileName)) {
                    var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
                    var filePath = Path.Combine(uploadsFolder, fileName);
                    if (System.IO.File.Exists(filePath)) System.IO.File.Delete(filePath);
                }
                return Ok(new { message = "Gelöscht" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("reorder")]
        public IActionResult ReorderMedia([FromBody] List<int> orderedIds)
        {
            try {
                DatabaseMonitors.UpdateMediaOrder(orderedIds);
                return Ok(new { message = "Reihenfolge gespeichert" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("{id}/publish-item")]
        public IActionResult PublishSingleItem(int id)
        {
            try {
                DatabaseMonitors.SetMediaLiveStatus(id, 1);
                return Ok(new { message = "Item is now live" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("publish-all/{monitorId}")]
        public IActionResult PublishAllItems(string monitorId, [FromQuery] string tabName)
        {
            try {
                DatabaseMonitors.PublishAllMediaForMonitor(monitorId, tabName);
                return Ok(new { message = "Alle live" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }
        [HttpGet("archive/{monitorId}")]
        public IActionResult GetArchivedMedia(string monitorId)
        {
            try {
                var archiveList = DatabaseMonitors.GetArchivedMediaForMonitor(monitorId);
                return Ok(archiveList);
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }
        [HttpGet("archive")] // <--- Wichtig: Keine {monitorId} in der Klammer!
        public IActionResult GetAllArchivedMedia()
        {
            try {
                var archiveList = DatabaseMonitors.GetAllArchivedMedia();
                return Ok(archiveList);
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }
        [HttpPost("{id}/archive")]
        public IActionResult MoveToArchive(int id)
        {
            try {
                string resultMessage = DatabaseMonitors.MoveMediaToArchive(id);
                return Ok(new { message = resultMessage });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }
        // --- TEMPORÄRER TESTDATEN-GENERATOR ---
        [HttpPost("seed-archive")] // <--- Wir brauchen keine ID mehr aus React
        public IActionResult SeedTestArchive()
        {
            using (var connection = new Microsoft.Data.Sqlite.SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();

                // 1. Wir suchen uns einen echten Monitor aus der Datenbank
                command.CommandText = "SELECT Id FROM Monitors LIMIT 1;";
                var validMonitorId = command.ExecuteScalar()?.ToString();

                // 2. Gibt es noch gar keine Monitore? Dann bauen wir schnell einen Dummy!
                if (string.IsNullOrEmpty(validMonitorId))
                {
                    validMonitorId = "dummy-monitor-1";
                    
                    // Zuerst eine Location (weil ein Monitor eine Location braucht)
                    command.CommandText = "INSERT OR IGNORE INTO Locations (Id, Name) VALUES ('dummy-loc', 'Test Rathaus');";
                    command.ExecuteNonQuery();

                    // Dann den Monitor
                    command.CommandText = "INSERT OR IGNORE INTO Monitors (Id, LocationId, Name, IP, Resolution) VALUES ('dummy-monitor-1', 'dummy-loc', 'Test Monitor', '127.0.0.1', '1920x1080');";
                    command.ExecuteNonQuery();
                }

                // 3. Jetzt werfen wir die 3 Test-Dokumente mit einer GÜLTIGEN MonitorId ins Archiv
                command.CommandText = @"
                    INSERT INTO MediaArchive (MonitorId, Title, DocNumber, Category, StartDate, EndDate, Url, IsProtected, PinCode)
                    VALUES 
                    (@MonitorId, 'Änderung des Flächenwidmungsplans', 'BW-BV-BAU-65/2026', 'Kundmachung', '01.04.2026', '15.04.2026', '/uploads/test1.jpg', 0, ''),
                    (@MonitorId, 'Stellenausschreibung Bauhofmitarbeiter', '031-3/A/2114/2026', 'Stellenausschreibung', '10.03.2026', '30.03.2026', '/uploads/test2.jpg', 0, ''),
                    (@MonitorId, 'Verordnung über Parkgebühren', 'VO-99/2026', 'Verordnung', '01.01.2026', '28.02.2026', '/uploads/test3.jpg', 1, '1234');
                ";
                command.Parameters.AddWithValue("@MonitorId", validMonitorId);
                
                command.ExecuteNonQuery();
            }
            return Ok(new { message = "3 Test-Dokumente erfolgreich ins Archiv gelegt!" });
        }
        [HttpDelete("archive/{id}")]
        public IActionResult DeleteArchivedMedia(int id)
        {
            using (var connection = new Microsoft.Data.Sqlite.SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                // Wir löschen es einfach spurlos aus dem Archiv
                command.CommandText = "DELETE FROM MediaArchive WHERE Id = @Id;";
                command.Parameters.AddWithValue("@Id", id);
                command.ExecuteNonQuery();
            }
            return Ok(new { message = "Endgültig gelöscht." });
        }

        public class RestoreRequest { public string newEndDate { get; set; } }

        [HttpPost("archive/restore/{id}")]
        public IActionResult RestoreArchivedMedia(int id, [FromBody] RestoreRequest req)
        {
            using (var connection = new Microsoft.Data.Sqlite.SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction())
                {
                    try
                    {
                        var command = connection.CreateCommand();
                        command.Transaction = transaction;

                        // 1. Wir kopieren das Dokument zurück in ScreenMedia mit dem NEUEN Datum
                        // Wir tricksen ein bisschen: Url im Archiv ist "/uploads/bild.jpg", wir extrahieren "bild.jpg"
                        command.CommandText = @"
                            INSERT INTO ScreenMedia (MonitorId, Title, DocNumber, Category, ExpirationDate, TabName, FileName, IsProtected, PinCode, KeepInArchive)
                            SELECT MonitorId, Title, DocNumber, Category, @NewDate, 'uploads', REPLACE(Url, '/uploads/', ''), IsProtected, PinCode, 1 
                            FROM MediaArchive WHERE Id = @Id;
                        ";
                        command.Parameters.AddWithValue("@Id", id);
                        command.Parameters.AddWithValue("@NewDate", req.newEndDate);
                        command.ExecuteNonQuery();

                        // 2. Wir löschen es aus dem Archiv, da es ja jetzt wieder "Live" ist
                        command.CommandText = "DELETE FROM MediaArchive WHERE Id = @Id;";
                        command.ExecuteNonQuery();

                        transaction.Commit();
                        return Ok(new { message = "Wiederhergestellt!" });
                    }
                    catch (Exception ex)
                    {
                        transaction.Rollback();
                        return BadRequest("Fehler beim Wiederherstellen: " + ex.Message);
                    }
                }
            }
        }
        // Hilfsklasse für den Bulk-Upload
        public class BulkTargetDto 
        {
            public string monitorId { get; set; }
            public string tabName { get; set; }
        }

        [HttpPost("bulk-upload")]
        public async Task<IActionResult> BulkUploadMedia(
            [FromForm] IFormFile file, 
            [FromForm] string monitorTargetsJson, // <-- Nimmt jetzt ein Array von Objekten!
            [FromForm] string title = null,
            [FromForm] string content = null,
            [FromForm] string expirationDate = null,
            [FromForm] string eventDate = null,
            [FromForm] string docNumber = null,
            [FromForm] string category = null,
            [FromForm] int isProtected = 0,
            [FromForm] string pinCode = null,
            [FromForm] int keepInArchive = 0)
        {
            if (file == null || string.IsNullOrEmpty(monitorTargetsJson)) 
                return BadRequest("Daten unvollständig.");

            // Wir entpacken die Liste!
            var targets = System.Text.Json.JsonSerializer.Deserialize<List<BulkTargetDto>>(monitorTargetsJson);
            
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var uniqueFileName = $"{Guid.NewGuid().ToString().Substring(0, 5)}_{file.FileName}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);
            using (var stream = new FileStream(filePath, FileMode.Create)) { await file.CopyToAsync(stream); }

            // Schleife über alle markierten Buttons/Monitore
            foreach (var target in targets) 
            {
                DatabaseMonitors.AddMediaToMonitor(
                    target.monitorId, 
                    target.tabName, 
                    uniqueFileName, 
                    file.ContentType.StartsWith("video") ? "video" : "image", 
                    "20s", title, content, eventDate, "", expirationDate,
                    docNumber, category, isProtected, pinCode, keepInArchive
                );
            }
            
            return Ok(new { message = $"Erfolgreich verteilt!" });
        }
        // Hilfsklasse für den Request
        public class LayoutUpdateRequest
        {
            public string LayoutType { get; set; }
            public int ButtonCount { get; set; }
            public string ButtonNames { get; set; }
            public string ButtonTypes { get; set; }
        }

        [HttpPut("monitor/{id}/layout")]
        public IActionResult UpdateMonitorLayout(string id, [FromBody] LayoutUpdateRequest req)
        {
            using (var connection = new Microsoft.Data.Sqlite.SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                
                // Wir updaten den Monitor in der Datenbank
                command.CommandText = @"
                    UPDATE Monitors 
                    SET LayoutType = @layout, 
                        ButtonCount = @count, 
                        ButtonNames = @names, 
                        ButtonTypes = @types 
                    WHERE Id = @id;";
                    
                command.Parameters.AddWithValue("@id", id);
                command.Parameters.AddWithValue("@layout", req.LayoutType ?? "sidebar");
                command.Parameters.AddWithValue("@count", req.ButtonCount);
                command.Parameters.AddWithValue("@names", req.ButtonNames ?? "");
                command.Parameters.AddWithValue("@types", req.ButtonTypes ?? "");

                command.ExecuteNonQuery();
            }
            return Ok(new { message = "Layout erfolgreich gespeichert!" });
        }
    }
}