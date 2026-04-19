namespace CitySync.Models
{
    public class SystemSettings
    {
        public string Theme { get; set; } = "dark";
        public int DefaultDuration { get; set; } = 12;
        public int AutoDeleteYears { get; set; } = 3;
        public string NightlyRestartTime { get; set; } = "03:00";
    }
}