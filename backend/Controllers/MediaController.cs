using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.Threading.Tasks;
using PdfiumViewer;
using System.Drawing.Imaging;
using System.Collections.Generic;
using Xabe.FFmpeg;
using CitySync.Models;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.SignalR; // Wichtig für IHubContext
using CitySync.Hubs; // Oder wie auch immer der Ordner heißt, in dem dein PlayerHub liegt

namespace CitySyncApi.Controllers
{
    [ApiController]
    [Route("api/media")]
    public class MediaController : ControllerBase
    {
        // --- DAS HIER EINFÜGEN ---
        private readonly IHubContext<PlayerHub> _hubContext;

        // Der Konstruktor injiziert den HubContext beim Starten des Backends
        public MediaController(IHubContext<PlayerHub> hubContext)
        {
            _hubContext = hubContext;
        }
        
        // =========================================================================
        // DER TÜRSTEHER: Prüft, ob der User das Recht hat
        // =========================================================================
        private bool HasPermission(string userIdStr, string permissionKey)
        {
            if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out int userId)) 
                return false;

            using (var connection = new SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                var cmd = connection.CreateCommand();
                
                // Prüft Rechte. Administratoren dürfen immer alles.
                cmd.CommandText = @"
                    SELECT COUNT(*) 
                    FROM Users u
                    JOIN Roles r ON u.RoleId = r.Id
                    LEFT JOIN RolePermissions rp ON r.Id = rp.RoleId
                    LEFT JOIN Permissions p ON rp.PermissionId = p.Id
                    WHERE u.Id = @userId AND (p.PermissionKey = @permKey OR r.Name = 'Administrator')";
                    
                cmd.Parameters.AddWithValue("@userId", userId);
                cmd.Parameters.AddWithValue("@permKey", permissionKey);

                long count = (long)cmd.ExecuteScalar();
                return count > 0;
            }
        }

        // =========================================================================
        // MEDIEN UPLOAD & BEARBEITEN
        // =========================================================================
        [HttpPost("upload")]
        public async Task<IActionResult> UploadMedia(
            [FromForm] string userId, // <--- Auth Check
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
            if (!HasPermission(userId, "media.upload")) return StatusCode(403, "Keine Berechtigung zum Hochladen.");
            if (file == null || file.Length == 0) return BadRequest("Keine Datei hochgeladen.");

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var generatedUrls = new List<string>();
            string thumbnailUrl = null;

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
            else if (file.ContentType.StartsWith("video"))
            {
                var videoName = $"{Guid.NewGuid().ToString().Substring(0, 5)}_{file.FileName}";
                var videoPath = Path.Combine(uploadsFolder, videoName);
                var thumbName = Path.GetFileNameWithoutExtension(videoName) + "_thumb.jpg";
                var thumbPath = Path.Combine(uploadsFolder, thumbName);

                using (var stream = new FileStream(videoPath, FileMode.Create)) { await file.CopyToAsync(stream); }

                var conversion = await FFmpeg.Conversions.New().AddParameter($"-i \"{videoPath}\" -ss 00:00:01 -vframes 1 -q:v 2 \"{thumbPath}\"").Start();

                DatabaseMonitors.AddMediaToMonitor(
                    monitorId, tabName, videoName, "video", duration, 
                    title, content, eventDate, eventTime, expirationDate,
                    docNumber, category, isProtected, pinCode, keepInArchive
                );
                generatedUrls.Add($"/uploads/{videoName}");
                thumbnailUrl = $"/uploads/{thumbName}";
            }
            else 
            {
                var uniqueFileName = $"{Guid.NewGuid().ToString().Substring(0, 5)}_{file.FileName}";
                var filePath = Path.Combine(uploadsFolder, uniqueFileName);
                using (var stream = new FileStream(filePath, FileMode.Create)) { await file.CopyToAsync(stream); }
                
                DatabaseMonitors.AddMediaToMonitor(
                    monitorId, tabName, uniqueFileName, "image", duration, 
                    title, content, eventDate, eventTime, expirationDate,
                    docNumber, category, isProtected, pinCode, keepInArchive
                );
                generatedUrls.Add($"/uploads/{uniqueFileName}");
            }

            return Ok(new { urls = generatedUrls, thumbnailUrl = thumbnailUrl });
        }

        [HttpPut("update/{id}")]
        public IActionResult UpdateMediaItem(int id, [FromBody] UpdateMediaRequest req)
        {
            if (!HasPermission(req.UserId, "media.upload")) return StatusCode(403, "Keine Berechtigung zum Bearbeiten.");

            try {
                DatabaseMonitors.UpdateMediaData(
                    id, req.Title, req.Content, req.EventDate, req.EventTime, 
                    req.ExpirationDate, req.DocNumber, req.Category, req.IsProtected, req.PinCode, req.KeepInArchive
                );
                return Ok(new { message = "Erfolgreich aktualisiert" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}")]
        public IActionResult DeleteMedia(int id, [FromQuery] string userId)
        {
            if (!HasPermission(userId, "media.delete")) return StatusCode(403, "Keine Berechtigung zum Löschen.");

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
        public IActionResult ReorderMedia([FromBody] ReorderRequest req)
        {
            if (!HasPermission(req.UserId, "media.upload")) return StatusCode(403, "Keine Berechtigung.");

            try {
                DatabaseMonitors.UpdateMediaOrder(req.OrderedIds);
                return Ok(new { message = "Reihenfolge gespeichert" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // =========================================================================
        // PUBLISH FUNKTIONEN
        // =========================================================================
        [HttpPost("{id}/publish-item")]
        public IActionResult PublishSingleItem(int id, [FromBody] PublishRequest req)
        {
            if (!HasPermission(req.UserId, "media.publish")) return StatusCode(403, "Keine Berechtigung.");

            try {
                DatabaseMonitors.SetMediaLiveStatus(id, 1);
                return Ok(new { message = "Item is now live" });
            } catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("publish-all/{monitorId}")]
        public async Task<IActionResult> PublishAllItems(string monitorId, [FromQuery] string tabName, [FromBody] PublishRequest req)
        {
            if (!HasPermission(req.UserId, "media.publish")) return StatusCode(403, "Keine Berechtigung.");

            try {
                // 1. In der Datenbank auf IsLive = 1 setzen
                DatabaseMonitors.PublishAllMediaForMonitor(monitorId, tabName);

                // 2. Den Monitor per Funk (SignalR) wecken
                // Wir schicken den Befehl "UpdateContent" an alle Geräte in der Gruppe (monitorId)
                await _hubContext.Clients.Group(monitorId).SendAsync("UpdateContent");

                return Ok(new { message = "Alle Inhalte sind jetzt live und der Monitor wurde benachrichtigt." });
            } catch (Exception ex) { 
                return BadRequest(ex.Message); 
            }
        }

        // =========================================================================
        // BULK UPLOAD
        // =========================================================================
        [HttpPost("bulk-upload")]
        public async Task<IActionResult> BulkUploadMedia(
            [FromForm] string userId,
            [FromForm] IFormFile file, 
            [FromForm] string monitorTargetsJson,
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
            if (!HasPermission(userId, "media.publish")) return StatusCode(403, "Keine Berechtigung für Bulk-Uploads.");
            if (file == null || string.IsNullOrEmpty(monitorTargetsJson)) return BadRequest("Daten unvollständig.");

            var targets = System.Text.Json.JsonSerializer.Deserialize<List<BulkTargetDto>>(monitorTargetsJson);
            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var uniqueFileName = $"{Guid.NewGuid().ToString().Substring(0, 5)}_{file.FileName}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);
            using (var stream = new FileStream(filePath, FileMode.Create)) { await file.CopyToAsync(stream); }

            foreach (var target in targets) 
            {
                DatabaseMonitors.AddMediaToMonitor(
                    target.monitorId, target.tabName, uniqueFileName, 
                    file.ContentType.StartsWith("video") ? "video" : "image", 
                    "20s", title, content, eventDate, "", expirationDate,
                    docNumber, category, isProtected, pinCode, keepInArchive
                );
            }
            
            return Ok(new { message = $"Erfolgreich verteilt!" });
        }

        // =========================================================================
        // LESE-ZUGRIFFE (Brauchen keinen harten Rechte-Check)
        // =========================================================================
        [HttpGet("{monitorId}")]
        public IActionResult GetMedia(string monitorId)
        {
            try { return Ok(DatabaseMonitors.GetMediaForMonitor(monitorId)); } 
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("archive/{monitorId}")]
        public IActionResult GetArchivedMedia(string monitorId)
        {
            try { return Ok(DatabaseMonitors.GetArchivedMediaForMonitor(monitorId)); } 
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("archive")]
        public IActionResult GetAllArchivedMedia()
        {
            try { return Ok(DatabaseMonitors.GetAllArchivedMedia()); } 
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // =========================================================================
        // ARCHIV MANAGEMENT
        // =========================================================================
        [HttpPost("{id}/archive")]
        public IActionResult MoveToArchive(int id, [FromQuery] string userId)
        {
            if (!HasPermission(userId, "media.delete")) return StatusCode(403, "Keine Berechtigung.");
            try { return Ok(new { message = DatabaseMonitors.MoveMediaToArchive(id) }); } 
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("archive/{id}")]
        public IActionResult DeleteArchivedMedia(int id, [FromQuery] string userId)
        {
            if (!HasPermission(userId, "media.delete")) return StatusCode(403, "Keine Berechtigung.");
            using (var connection = new SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "DELETE FROM MediaArchive WHERE Id = @Id;";
                command.Parameters.AddWithValue("@Id", id);
                command.ExecuteNonQuery();
            }
            return Ok(new { message = "Endgültig gelöscht." });
        }

        [HttpPost("archive/restore/{id}")]
        public IActionResult RestoreArchivedMedia(int id, [FromBody] RestoreRequest req)
        {
            if (!HasPermission(req.UserId, "media.upload")) return StatusCode(403, "Keine Berechtigung.");
            using (var connection = new SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction())
                {
                    try
                    {
                        var command = connection.CreateCommand();
                        command.Transaction = transaction;

                        command.CommandText = @"
                            INSERT INTO ScreenMedia (MonitorId, Title, DocNumber, Category, ExpirationDate, TabName, FileName, IsProtected, PinCode, KeepInArchive)
                            SELECT MonitorId, Title, DocNumber, Category, @NewDate, 'uploads', REPLACE(Url, '/uploads/', ''), IsProtected, PinCode, 1 
                            FROM MediaArchive WHERE Id = @Id;
                        ";
                        command.Parameters.AddWithValue("@Id", id);
                        command.Parameters.AddWithValue("@NewDate", req.newEndDate);
                        command.ExecuteNonQuery();

                        command.CommandText = "DELETE FROM MediaArchive WHERE Id = @Id;";
                        command.ExecuteNonQuery();

                        transaction.Commit();
                        return Ok(new { message = "Wiederhergestellt!" });
                    }
                    catch (Exception ex) { transaction.Rollback(); return BadRequest(ex.Message); }
                }
            }
        }

        // =========================================================================
        // LAYOUT & SETTINGS
        // =========================================================================
        [HttpPut("monitor/{id}/layout")]
        public async Task<IActionResult> UpdateMonitorLayoutAsync(string id, [FromBody] LayoutUpdateRequest req)
        {
            if (!HasPermission(req.UserId, "screens.manage")) return StatusCode(403, "Keine Berechtigung.");

            using (var connection = new SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = @"
                    UPDATE Monitors 
                    SET LayoutType = @layout, ButtonCount = @count, ButtonNames = @names, ButtonTypes = @types 
                    WHERE Id = @id;";
                    
                command.Parameters.AddWithValue("@id", id);
                command.Parameters.AddWithValue("@layout", req.LayoutType ?? "sidebar");
                command.Parameters.AddWithValue("@count", req.ButtonCount);
                command.Parameters.AddWithValue("@names", req.ButtonNames ?? "");
                command.Parameters.AddWithValue("@types", req.ButtonTypes ?? "");

                command.ExecuteNonQuery();
            }
            await _hubContext.Clients.Group(id).SendAsync("UpdateContent");
            return Ok(new { message = "Layout erfolgreich gespeichert!" });
        }

        [HttpPost("seed-archive")]
        public IActionResult SeedTestArchive()
        {
            // Hilfsfunktion (unverändert)
            using (var connection = new SqliteConnection(DatabaseMonitors.ConnectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "SELECT Id FROM Monitors LIMIT 1;";
                var validMonitorId = command.ExecuteScalar()?.ToString();

                if (string.IsNullOrEmpty(validMonitorId)) {
                    validMonitorId = "dummy-monitor-1";
                    command.CommandText = "INSERT OR IGNORE INTO Locations (Id, Name) VALUES ('dummy-loc', 'Test Rathaus');";
                    command.ExecuteNonQuery();
                    command.CommandText = "INSERT OR IGNORE INTO Monitors (Id, LocationId, Name, IP, Resolution) VALUES ('dummy-monitor-1', 'dummy-loc', 'Test Monitor', '127.0.0.1', '1920x1080');";
                    command.ExecuteNonQuery();
                }

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
        
    }
}
