namespace EventCraft.Events.Models;

public class CuratedImageEntity
{
    public string ImageId   { get; set; } = string.Empty;
    public string Title     { get; set; } = string.Empty;
    public string Category  { get; set; } = "General";
    public string S3Key     { get; set; } = string.Empty;
    public string Url       { get; set; } = string.Empty;
    public bool   Active    { get; set; } = true;
    public string CreatedAt { get; set; } = string.Empty;
}

public class CreateCuratedRequest
{
    public string  Title       { get; set; } = string.Empty;
    public string? Category    { get; set; }
    public string? ContentType { get; set; }
}