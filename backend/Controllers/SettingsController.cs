using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using CitySync.Models; // Passe das an, falls dein Namespace anders ist

namespace CitySync.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SettingsController : ControllerBase
    {
        private readonly string _connectionString = "Data Source=citysync.db";

        [HttpGet]
        public IActionResult GetSettings()
        {
            var settings = new SystemSettings();
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "SELECT SettingKey, SettingValue FROM SystemSettings";
                
                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        var key = reader.GetString(0);
                        var value = reader.GetString(1);

                        switch (key)
                        {
                            case "Theme": settings.Theme = value; break;
                            case "DefaultDuration": settings.DefaultDuration = int.TryParse(value, out int d) ? d : 12; break;
                            case "AutoDeleteYears": settings.AutoDeleteYears = int.TryParse(value, out int y) ? y : 3; break;
                            case "NightlyRestartTime": settings.NightlyRestartTime = value; break;
                            // --- NEUE BRANDING KEYS ---
                            case "MunicipalityName": settings.MunicipalityName = value; break;
                            case "LogoBase64": settings.LogoBase64 = value; break;
                            case "GlobalTicker": settings.GlobalTicker = value; break;
                        }
                    }
                }
            }
            return Ok(settings);
        }

        [HttpPost]
        public IActionResult UpdateSettings([FromBody] SystemSettings settings)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                using (var transaction = connection.BeginTransaction())
                {
                    var command = connection.CreateCommand();
                    command.Transaction = transaction;

                    // Wir erweitern deine Arrays um die 3 neuen Felder
                    string[] keys = { 
                        "Theme", "DefaultDuration", "AutoDeleteYears", "NightlyRestartTime", 
                        "MunicipalityName", "LogoBase64", "GlobalTicker" 
                    };
                    
                    string[] values = { 
                        settings.Theme ?? "dark", 
                        settings.DefaultDuration.ToString(), 
                        settings.AutoDeleteYears.ToString(), 
                        settings.NightlyRestartTime ?? "",
                        settings.MunicipalityName ?? "",
                        settings.LogoBase64 ?? "",
                        settings.GlobalTicker ?? ""
                    };

                    for (int i = 0; i < keys.Length; i++)
                    {
                        command.CommandText = "INSERT OR REPLACE INTO SystemSettings (SettingKey, SettingValue) VALUES (@key, @val)";
                        command.Parameters.Clear();
                        command.Parameters.AddWithValue("@key", keys[i]);
                        command.Parameters.AddWithValue("@val", values[i]);
                        command.ExecuteNonQuery();
                    }

                    transaction.Commit();
                }
            }
            return Ok(new { message = "Einstellungen erfolgreich gespeichert" });
        }
    }
}