using Microsoft.AspNetCore.Mvc;

namespace CitySyncApi.Controllers
{
    // Diese beiden Befehle OHNE // sind extrem wichtig!
    [ApiController]
    [Route("api/monitors")]
    public class MonitorController : ControllerBase
    {
        // 1. Die Hilfsklasse (DTO)
        // 1. Die Hilfsklasse (DTO) - Jetzt mit Standardwerten!
        public class ScreenConfigDto
        {
            public string LayoutType { get; set; } = "sidebar";
            public int ButtonCount { get; set; }
            public string ButtonNames { get; set; } = "";
            public string ButtonTypes { get; set; } = "";
        }

        // 2. Der Endpunkt
        [HttpPut("{id}/config")]
        public IActionResult SaveConfig(string id, [FromBody] ScreenConfigDto config)
        {
            try
            {
                DatabaseMonitors.SaveScreenConfig(
                    id, 
                    config.LayoutType, 
                    config.ButtonCount, 
                    config.ButtonNames, 
                    config.ButtonTypes
                );
                return Ok(new { message = "Layout erfolgreich gespeichert" });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
        // POST /api/monitors/{id}/publish
        [HttpPost("{id}/publish")]
        public IActionResult PublishMonitor(string id)
        {
            try
            {
                DatabaseMonitors.PublishMonitor(id);
                return Ok(new { message = "Erfolgreich veröffentlicht!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Fehler beim Veröffentlichen: " + ex.Message);
            }
        }
    }
}