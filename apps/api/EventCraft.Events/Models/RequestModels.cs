namespace EventCraft.Events.Models;

public class CreateEventRequest
{
  public string Title { get; set; } = default!;
  public string? Description { get; set; }
  public string EventDate { get; set; } = default!;
  public string? EndDate { get; set; }
  public string? Location { get; set; }
  public string? Address { get; set; }
  public int? Capacity { get; set; }
  public List<string>? Tags { get; set; }
  public string? RsvpDeadline { get; set; }
}

public class UpdateEventRequest
{
  public string? Title { get; set; }
  public string? Description { get; set; }
  public string? EventDate { get; set; }
  public string? EndDate { get; set; }
  public string? Location { get; set; }
  public string? Address { get; set; }
  public int? Capacity { get; set; }
  public List<string>? Tags { get; set; }
  public string? RsvpDeadline { get; set; }
  public string? Status { get; set; }
  public string? CoverImageUrl { get; set; }
}

public class PublishEventRequest
{
  public string MicrositeSlug { get; set; } = default!;
}

public class SaveDesignRequest
{
  public string CanvasJson { get; set; } = default!;
}
