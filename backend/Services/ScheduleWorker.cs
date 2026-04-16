using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Hosting;
using System.Diagnostics;

namespace CitySyncApi.Services;

// BackgroundService sagt .NET: "Lass diese Klasse im Hintergrund dauerhaft laufen!"
public class ScheduleWorker : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Console.WriteLine("🤖 ScheduleWorker: Bin aufgewacht! Starte 60-Sekunden-Rhythmus...");

        // Diese Schleife läuft unendlich, bis das Programm beendet wird
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                CheckAllMonitors();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Fehler im Worker: {ex.Message}");
            }

            // Der Worker schläft für genau 1 Minute, bevor er wieder prüft
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private void CheckAllMonitors()
    {
        // 1. Welche Uhrzeit und welcher Tag ist genau JETZT?
        var currentTime = DateTime.Now.TimeOfDay;
        string todayStr = GetGermanDayString(DateTime.Now.DayOfWeek);
        
        Console.WriteLine($"--- 🕒 Check um {DateTime.Now:HH:mm} Uhr (Tag: {todayStr}) ---");

        using (var connection = new SqliteConnection(DatabaseMonitors.ConnectionString))
        {
            connection.Open();

            // 2. Alle Monitore aus der Datenbank holen
            var monCmd = connection.CreateCommand();
            monCmd.CommandText = "SELECT Id, Name, IP FROM Monitors;";
            
            using (var reader = monCmd.ExecuteReader())
            {
                while (reader.Read())
                {
                    string monitorId = reader.GetString(0);
                    string monitorName = reader.GetString(1);
                    string monitorIp = reader.GetString(2);

                    // 3. Für jeden Monitor prüfen: Soll er AN oder AUS sein?
                    bool shouldBeOn = CheckIfMonitorShouldBeOn(connection, monitorId, todayStr, currentTime);

                    // 4. Den echten Befehl senden!
                    if (shouldBeOn)
                    {
                        Console.WriteLine($"🟢 {monitorName} ({monitorIp}) -> Befehl: EINSCHALTEN (Regel aktiv)");
                        // HIER KOMMT SPÄTER DEIN WAKE-ON-LAN ODER API-BEFEHL HIN!
                    }
                    else
                    {
                        Console.WriteLine($"🔴 {monitorName} ({monitorIp}) -> Befehl: AUSSCHALTEN (Keine Regel / Standard-Aus)");
                        // HIER KOMMT SPÄTER DEIN SHUTDOWN-BEFEHL HIN!
                    }
                }
            }
        }
    }

    // Hilfsfunktion: Prüft die Datenbank-Regeln für einen Monitor
    private bool CheckIfMonitorShouldBeOn(SqliteConnection connection, string monitorId, string today, TimeSpan currentTime)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT Days, StartTime, EndTime FROM Routines WHERE MonitorId = @mId;";
        cmd.Parameters.AddWithValue("@mId", monitorId);

        using (var reader = cmd.ExecuteReader())
        {
            while (reader.Read())
            {
                string days = reader.GetString(0);
                
                // Wenn die Regel für HEUTE gilt...
                if (days.Contains(today))
                {
                    // Zeiten umwandeln (z.B. von "08:00" in ein TimeSpan Objekt)
                    TimeSpan startTime = TimeSpan.Parse(reader.GetString(1));
                    TimeSpan endTime = TimeSpan.Parse(reader.GetString(2));

                    // Prüfen, ob wir uns JETZT genau in diesem Zeitfenster befinden
                    if (currentTime >= startTime && currentTime <= endTime)
                    {
                        return true; // Treffer! Monitor muss AN sein.
                    }
                }
            }
        }
        
        // Wenn die Schleife durchläuft, ohne ein passendes Zeitfenster zu finden:
        return false; // Standardmäßig AUS!
    }

    // Hilfsfunktion: Übersetzt den englischen Wochentag in unser React-Format
    private string GetGermanDayString(DayOfWeek day)
    {
        return day switch
        {
            DayOfWeek.Monday => "Mo",
            DayOfWeek.Tuesday => "Di",
            DayOfWeek.Wednesday => "Mi",
            DayOfWeek.Thursday => "Do",
            DayOfWeek.Friday => "Fr",
            DayOfWeek.Saturday => "Sa",
            DayOfWeek.Sunday => "So",
            _ => ""
        };
    }
}