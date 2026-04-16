using Microsoft.AspNetCore.Mvc;

namespace CitySyncApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    // GET: api/dashboard
    // Holt alle Standorte und Monitore für das Frontend
    [HttpGet]
    public IActionResult GetDashboard()
    {
        try
        {
            var data = DatabaseMonitors.GetDashboardData();
            return Ok(data);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Interner Fehler: {ex.Message}");
        }
    }

    // POST: api/dashboard/monitor
    // Fügt einen neuen Monitor (und ggf. Standort) hinzu
    [HttpPost("monitor")]
    public IActionResult AddMonitor([FromBody] AddMonitorRequest request)
    {
        try
        {
            // 1. Falls es ein neuer Standort ist, diesen anlegen
            DatabaseMonitors.UpsertLocation(request.LocationId, request.LocationName);

            // 2. Monitor speichern
            DatabaseMonitors.InsertMonitor(
                request.Id, 
                request.LocationId, 
                request.Name, 
                request.Ip, 
                request.Resolution
            );

            return Ok(new { message = "Monitor erfolgreich registriert" });
        }
        catch (Exception ex)
        {
            return BadRequest($"Fehler beim Hinzufügen: {ex.Message}");
        }
    }

    // PUT: api/dashboard/monitor/{id}
    // Bearbeitet einen bestehenden Monitor
    [HttpPut("monitor/{id}")]
    public IActionResult UpdateMonitor(string id, [FromBody] UpdateMonitorRequest request)
    {
        try
        {
            DatabaseMonitors.UpdateMonitor(id, request.Name, request.Ip, request.Resolution);
            return Ok(new { message = "Änderungen gespeichert" });
        }
        catch (Exception ex)
        {
            return BadRequest($"Fehler beim Update: {ex.Message}");
        }
    }

    // DELETE: api/dashboard/monitor/{id}
    [HttpDelete("monitor/{id}")]
    public IActionResult DeleteMonitor(string id)
    {
        try
        {
            DatabaseMonitors.DeleteMonitor(id);
            return Ok(new { message = "Monitor gelöscht" });
        }
        catch (Exception ex)
        {
            return BadRequest($"Fehler beim Löschen: {ex.Message}");
        }
    }
}

// Hilfsklassen für den Datenaustausch (JSON-Struktur)
public record AddMonitorRequest(string Id, string LocationId, string LocationName, string Name, string Ip, string Resolution);
public record UpdateMonitorRequest(string Name, string Ip, string Resolution);