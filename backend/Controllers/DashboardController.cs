using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR; // <-- WICHTIG: Für SignalR
using CitySync.Hubs; // <-- WICHTIG: Passe das an deinen tatsächlichen Projektnamen an, falls er anders heißt (z.B. CitySyncApi.Hubs)
using System.Threading.Tasks;

namespace CitySyncApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    // --- NEU: DIE SIGNALR STANDLEITUNG EINBINDEN ---
    private readonly IHubContext<PlayerHub> _hubContext;

    public DashboardController(IHubContext<PlayerHub> hubContext)
    {
        _hubContext = hubContext;
    }
    // -----------------------------------------------

    // GET: api/dashboard
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
    [HttpPost("monitor")]
    public IActionResult AddMonitor([FromBody] AddMonitorRequest request)
    {
        try
        {
            DatabaseMonitors.UpsertLocation(request.LocationId, request.LocationName);
            DatabaseMonitors.InsertMonitor(request.Id, request.LocationId, request.Name, request.Ip, request.Resolution);
            return Ok(new { message = "Monitor erfolgreich registriert" });
        }
        catch (Exception ex)
        {
            return BadRequest($"Fehler beim Hinzufügen: {ex.Message}");
        }
    }

    // PUT: api/dashboard/monitor/{id}
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
    // --- NEU: AUF ASYNC UMGESTELLT UND FUNKSPRUCH HINZUGEFÜGT ---
    [HttpDelete("monitor/{id}")]
    public async Task<IActionResult> DeleteMonitor(string id)
    {
        try
        {
            // 1. Aus der Datenbank löschen
            DatabaseMonitors.DeleteMonitor(id);
            
            // 2. Den Selbstzerstörungs-Befehl an exakt diesen Player senden!
            await _hubContext.Clients.Group(id).SendAsync("FactoryReset");
            
            return Ok(new { message = "Monitor gelöscht und auf Werkseinstellungen zurückgesetzt" });
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