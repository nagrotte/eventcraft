namespace EventCraft.Events.Models;
public class CreateEventRequest
{
    public string  Title       { get; set; } = default!;
    public string? Description { get; set; }
    public string  EventDate   { get; set; } = default!;
    public string? EndDate     { get; set; }
    public string? Location    { get; set; }
    public string? Address     { get; set; }
    public int?    Capacity    { get; set; }
    public List<string>? Tags  { get; set; }
    public string? RsvpDeadline { get; set; }
}
public class UpdateEventRequest
{
    public string? Title        { get; set; }
    public string? Description  { get; set; }
    public string? EventDate    { get; set; }
    public string? EndDate      { get; set; }
    public string? Location     { get; set; }
    public string? Address      { get; set; }
    public int?    Capacity     { get; set; }
    public List<string>? Tags   { get; set; }
    public string? RsvpDeadline { get; set; }
    public string? Status       { get; set; }
    public string? CoverImageUrl   { get; set; }
    public string? MicrositeSlug   { get; set; }
    public string? OrganizerName   { get; set; }
    public string? OrganizerPhone  { get; set; }
    public string? OrganizerEmail  { get; set; }
    public string? Schedule        { get; set; }
    public string? GalleryUrl      { get; set; }
}
public class PublishEventRequest
{
    public string MicrositeSlug { get; set; } = default!;
}
public class SaveDesignRequest
{
    public string CanvasJson { get; set; } = default!;
}
public class UploadUrlRequest
{
    public string FileName    { get; set; } = default!;
    public string ContentType { get; set; } = "image/jpeg";
}
public class RsvpRequest
{
    public string  Name       { get; set; } = default!;
    public string  Email      { get; set; } = default!;
    public string  Response   { get; set; } = "yes"; // yes | no | maybe
    public string? Message    { get; set; }
    public int     GuestCount { get; set; } = 1;
}
public class RsvpEntity
{
    public string  RsvpId     { get; set; } = default!;
    public string  EventId    { get; set; } = default!;
    public string  Name       { get; set; } = default!;
    public string  Email      { get; set; } = default!;
    public string  Response   { get; set; } = default!;
    public string? Message    { get; set; }
    public string  CreatedAt  { get; set; } = default!;
    public int     GuestCount { get; set; } = 1;
}
