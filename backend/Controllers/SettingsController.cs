using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using CitySync.Models;

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
                            case "DefaultDuration": settings.DefaultDuration = int.Parse(value); break;
                            case "AutoDeleteYears": settings.AutoDeleteYears = int.Parse(value); break;
                            case "NightlyRestartTime": settings.NightlyRestartTime = value; break;
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

                    // Wir nutzen INSERT OR REPLACE, um die Werte effizient zu aktualisieren
                    string[] keys = { "Theme", "DefaultDuration", "AutoDeleteYears", "NightlyRestartTime" };
                    string[] values = { 
                        settings.Theme, 
                        settings.DefaultDuration.ToString(), 
                        settings.AutoDeleteYears.ToString(), 
                        settings.NightlyRestartTime 
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