using System;

namespace CitySync.Models
{
    public class MediaArchiveItem
    {
        public int Id { get; set; } 
        public int OriginalMediaId { get; set; } 
        public string MonitorId { get; set; }
        public string Title { get; set; }
        public string DocNumber { get; set; }
        public string Category { get; set; }
        public string StartDate { get; set; } 
        public string EndDate { get; set; } 
        public string Url { get; set; } 
        public int IsProtected { get; set; }
        public string PinCode { get; set; }
        public DateTime ArchivedAt { get; set; }
    }
}