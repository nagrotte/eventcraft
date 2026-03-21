namespace EventCraft.Events.Models;

public class EventEntity
{
    public string PK            { get; set; } = default!;
    public string SK            { get; set; } = default!;
    public string GSI1PK        { get; set; } = default!;
    public string GSI1SK        { get; set; } = default!;
    public string EventId       { get; set; } = default!;
    public string UserId        { get; set; } = default!;
    public string Title         { get; set; } = default!;
    public string? Description  { get; set; }
    public string EventDate     { get; set; } = default!;
    public string? EndDate      { get; set; }
    public string? Location     { get; set; }
    public string? Address      { get; set; }
    public int?    Capacity     { get; set; }
    public string  Status       { get; set; } = "draft";
    public string? MicrositeSlug  { get; set; }
    public string? DesignId       { get; set; }
    public string? CoverImageUrl  { get; set; }
    public string? DesignJson     { get; set; }
    public List<string> Tags    { get; set; } = new();
    public string? RsvpDeadline { get; set; }
    public string CreatedAt     { get; set; } = default!;
    public string UpdatedAt     { get; set; } = default!;
    public string? Schedule       { get; set; }
    public string? OrganizerName  { get; set; }
    public string? OrganizerPhone { get; set; }
    public string? OrganizerEmail { get; set; }
    public string? GalleryUrl     { get; set; }
}