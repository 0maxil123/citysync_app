using Microsoft.AspNetCore.Mvc;

namespace CitySyncApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScheduleController : ControllerBase
{
    [HttpGet("{monitorId}")]
    public IActionResult GetRoutines(string monitorId)
    {
        try
        {
            var routines = DatabaseMonitors.GetRoutines(monitorId);
            return Ok(routines); // Schickt jetzt eine Liste
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Fehler beim Laden: {ex.Message}");
        }
    }

    [HttpPost]
    public IActionResult SaveRoutine([FromBody] SaveRoutineRequest request)
    {
        try
        {
            string daysString = string.Join(",", request.Days);
            DatabaseMonitors.SaveRoutine(request.MonitorId, daysString, request.StartTime, request.EndTime);
            return Ok(new { message = "Routine erfolgreich gespeichert!" });
        }
        catch (Exception ex)
        {
            return BadRequest($"Fehler beim Speichern: {ex.Message}");
        }
    }

    // ACHTUNG: Hier steht jetzt "int routineId"
    [HttpDelete("{routineId}")]
    public IActionResult DeleteRoutine(int routineId)
    {
        try
        {
            DatabaseMonitors.DeleteRoutine(routineId);
            return Ok(new { message = "Routine gelöscht" });
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}

public record SaveRoutineRequest(string MonitorId, List<string> Days, string StartTime, string EndTime);