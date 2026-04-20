public class ScreenConfigDto
    {
        public string LayoutType { get; set; } = "sidebar";
        public int ButtonCount { get; set; }
        public string ButtonNames { get; set; } = "";
        public string ButtonTypes { get; set; } = "";
    }
    // Hilfsklasse für die Auflösung
    public class RegisterRequest
    {
        public string Resolution { get; set; }
    }
    // Hilfsklasse für den Request
    public class ConfirmPairingRequest {
    public string? Name { get; set; }
    public string? LocationId { get; set; }
    public string? NewLocationName { get; set; }
    public string? PairingCode { get; set; }
    public string? Ip { get; set; }
    public string? Resolution { get; set; }
}