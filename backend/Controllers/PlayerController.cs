using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using System;
using CitySync.Models;
using CitySyncApi;

namespace CitySync.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PlayerController : ControllerBase
    {
        private readonly string _connectionString = "Data Source=CitySync.db"; 

        [HttpPost("register")]
        public IActionResult RegisterPlayer([FromBody] RegisterRequest request)
        {
            // 6-stelligen Code generieren
            string pairingCode = new Random().Next(100000, 999999).ToString();
            string ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Lokal";
            string resolution = request?.Resolution ?? "Unbekannt";

            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var cmd = connection.CreateCommand();
                    
                    // Fernseher ins Wartezimmer setzen
                    cmd.CommandText = @"
                        INSERT INTO PendingDevices (PairingCode, IpAddress, Resolution, CreatedAt) 
                        VALUES (@code, @ip, @resolution, @created)";
                    
                    cmd.Parameters.AddWithValue("@code", pairingCode);
                    cmd.Parameters.AddWithValue("@ip", ipAddress);
                    cmd.Parameters.AddWithValue("@resolution", resolution);
                    cmd.Parameters.AddWithValue("@created", DateTime.UtcNow);
                    
                    cmd.ExecuteNonQuery();
                }

                return Ok(new { pairingCode = pairingCode, clientIp = ipAddress });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Fehler beim Erstellen des Codes", error = ex.Message });
            }
        }

        [HttpGet("status")]
        public IActionResult CheckStatus([FromQuery] string code)
        {
            if (string.IsNullOrEmpty(code)) return BadRequest("Code fehlt.");

            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var cmd = connection.CreateCommand();
                    
                    // Schauen, ob im Wartezimmer schon eine echte Monitor-ID hinterlegt wurde
                    cmd.CommandText = "SELECT PairedMonitorId FROM PendingDevices WHERE PairingCode = @code";
                    cmd.Parameters.AddWithValue("@code", code);

                    var result = cmd.ExecuteScalar();

                    if (result != null && result != DBNull.Value)
                    {
                        // Juhu! Ein Admin hat uns adoptiert!
                        string monitorId = result.ToString();
                        return Ok(new { 
                            isPaired = true, 
                            screenConfig = new { monitorId = monitorId } 
                        });
                    }
                    else if (result == DBNull.Value)
                    {
                        // Code existiert, aber noch nicht gekoppelt
                        return Ok(new { isPaired = false });
                    }
                    else
                    {
                        // Code wurde nicht gefunden (vielleicht schon gelöscht oder falsch)
                        return NotFound(new { message = "Code ungültig." });
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Fehler beim Prüfen", error = ex.Message });
            }
        }
        // 3. ENDPUNKT: Das Dashboard prüft, ob der Code existiert und holt die Hardware-Daten
        [HttpGet("verify/{code}")]
        public IActionResult VerifyCode(string code)
        {
            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var cmd = connection.CreateCommand();
                    
                    // Wir suchen im Wartezimmer nach dem Code
                    cmd.CommandText = "SELECT IpAddress, Resolution FROM PendingDevices WHERE PairingCode = @code";
                    cmd.Parameters.AddWithValue("@code", code);

                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            // Code gefunden! Wir schicken die echten Daten ans Dashboard
                            return Ok(new { 
                                ip = reader["IpAddress"].ToString(), 
                                resolution = reader["Resolution"].ToString() 
                            });
                        }
                        else
                        {
                            // Code existiert nicht (falsch getippt oder schon gekoppelt)
                            return NotFound(new { message = "Code nicht gefunden oder ungültig." });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Datenbankfehler", error = ex.Message });
            }
        }
        [HttpPost("confirm")]
        public IActionResult ConfirmPairing([FromBody] ConfirmPairingRequest request)
        {
            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    
                    // 1. Prüfen, ob der Code im Wartezimmer existiert
                    var checkCmd = connection.CreateCommand();
                    checkCmd.CommandText = "SELECT PairingCode FROM PendingDevices WHERE PairingCode = @code";
                    checkCmd.Parameters.AddWithValue("@code", request.PairingCode);
                    
                    if (checkCmd.ExecuteScalar() == null)
                        return NotFound(new { message = "Dieser Pairing-Code ist nicht mehr gültig." });

                    // 2. Falls ein neuer Standort erstellt werden muss
                    string locationId = request.LocationId;
                    if (string.IsNullOrEmpty(locationId) && !string.IsNullOrEmpty(request.NewLocationName))
                    {
                        locationId = Guid.NewGuid().ToString();
                        var locCmd = connection.CreateCommand();
                        locCmd.CommandText = "INSERT INTO Locations (Id, Name) VALUES (@id, @name)";
                        locCmd.Parameters.AddWithValue("@id", locationId);
                        locCmd.Parameters.AddWithValue("@name", request.NewLocationName);
                        locCmd.ExecuteNonQuery();
                    }

                    // 3. Den echten Monitor anlegen
                    string newMonitorId = Guid.NewGuid().ToString();
                    var monitorCmd = connection.CreateCommand();
                    monitorCmd.CommandText = @"
                        INSERT INTO Monitors (Id, LocationId, Name, IP, Resolution, Status) 
                        VALUES (@id, @locId, @name, @ip, @res, 'online')";
                    
                    monitorCmd.Parameters.AddWithValue("@id", newMonitorId);
                    monitorCmd.Parameters.AddWithValue("@locId", locationId ?? "default");
                    monitorCmd.Parameters.AddWithValue("@name", request.Name);
                    monitorCmd.Parameters.AddWithValue("@ip", request.Ip);
                    monitorCmd.Parameters.AddWithValue("@res", request.Resolution);
                    monitorCmd.ExecuteNonQuery();

                    // 4. DAS WARTEZIMMER AKTUALISIEREN (Das triggert den Player!)
                    var updateCmd = connection.CreateCommand();
                    updateCmd.CommandText = "UPDATE PendingDevices SET PairedMonitorId = @mId WHERE PairingCode = @code";
                    updateCmd.Parameters.AddWithValue("@mId", newMonitorId);
                    updateCmd.Parameters.AddWithValue("@code", request.PairingCode);
                    updateCmd.ExecuteNonQuery();

                    return Ok(new { message = "Pairing erfolgreich", monitorId = newMonitorId });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Datenbankfehler beim Koppeln", error = ex.Message });
            }
        }
        // 4. ENDPUNKT: Der "Paranoia-Check" beim Starten des Players
        [HttpGet("check/{monitorId}")]
        public IActionResult CheckMonitor(string monitorId)
        {
            try
            {
                using (var connection = new SqliteConnection(_connectionString))
                {
                    connection.Open();
                    var cmd = connection.CreateCommand();
                    
                    // Wir schauen nach, ob der Monitor noch in der Datenbank existiert
                    cmd.CommandText = "SELECT Id FROM Monitors WHERE Id = @id";
                    cmd.Parameters.AddWithValue("@id", monitorId);

                    var result = cmd.ExecuteScalar();
                    
                    if (result != null)
                    {
                        // Alles gut, Monitor existiert noch!
                        return Ok(new { status = "active" });
                    }
                    else
                    {
                        // Monitor wurde gelöscht!
                        return NotFound(new { message = "Monitor existiert nicht mehr im System." });
                    }
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Datenbankfehler", error = ex.Message });
            }
        }
        [HttpGet("sync/{monitorId}")]
        public IActionResult Sync(string monitorId)
        {
            try 
            {
                var data = DatabaseMonitors.GetSyncData(monitorId);
                return Ok(data);
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        }


    }

}