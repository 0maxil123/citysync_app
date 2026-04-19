   public class UpdateMediaRequest {
        public string UserId { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public string EventDate { get; set; }
        public string EventTime { get; set; }
        public string ExpirationDate { get; set; }
        public string DocNumber { get; set; }
        public string Category { get; set; }
        public int IsProtected { get; set; }
        public string PinCode { get; set; }
        public int KeepInArchive { get; set; }
    }

    public class ReorderRequest {
        public string UserId { get; set; }
        public List<int> OrderedIds { get; set; }
    }

    public class PublishRequest {
        public string UserId { get; set; }
    }

    public class RestoreRequest {
        public string UserId { get; set; }
        public string newEndDate { get; set; }
    }

    public class LayoutUpdateRequest {
        public string UserId { get; set; }
        public string LayoutType { get; set; }
        public int ButtonCount { get; set; }
        public string ButtonNames { get; set; }
        public string ButtonTypes { get; set; }
    }

    public class BulkTargetDto {
        public string monitorId { get; set; }
        public string tabName { get; set; }
    }

