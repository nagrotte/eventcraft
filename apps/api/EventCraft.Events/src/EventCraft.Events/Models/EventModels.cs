using System.Text.Json.Serialization;

namespace EventCraft.Events.Models;

// ── DynamoDB Entity ───────────────────────────────────────────────────────────

public sealed class EventEntity
{
    [JsonPropertyName("PK")]        public string PK          { get; set; } = default!;
    [JsonPropertyName("SK")]        public string SK          { get; set; } = default!;
    [JsonPropertyName("GSI1PK")]    public string GSI1PK      { get; set; } = default!;
    [JsonPropertyName("GSI1SK")]    public string GSI1SK      { get; set; } = default!;
    [JsonPropertyName("eventId")]   public string EventId     { get; set; } = default!;
    [JsonPropertyName("userId")]    public string UserId      { get; set; } = default!;
    [JsonPropertyName("title")]     public string Title       { get; set; } = default!;
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("eventDate")] public string EventDate   { get; set; } = default!;
    [JsonPropertyName("endDate")]   public string? EndDate    { get; set; }
    [JsonPropertyName("location")]  public string? Location   { get; set; }
    [JsonPropertyName("address")]   public string? Address    { get; set; }
    [JsonPropertyName("capacity")]  public int?    Capacity   { get; set; }
    [JsonPropertyName("status")]    public string Status      { get; set; } = "draft";
    [JsonPropertyName("micrositeSlug")] public string? MicrositeSlug { get; set; }
    [JsonPropertyName("designId")]  public string? DesignId   { get; set; }
    [JsonPropertyName("coverImageUrl")] public string? CoverImageUrl { get; set; }
    [JsonPropertyName("tags")]      public List<string> Tags  { get; set; } = [];
    [JsonPropertyName("rsvpDeadline")] public string? RsvpDeadline { get; set; }
    [JsonPropertyName("createdAt")] public string CreatedAt   { get; set; } = default!;
    [JsonPropertyName("updatedAt")] public string UpdatedAt   { get; set; } = default!;
}

// ── RSVP Entity ───────────────────────────────────────────────────────────────

public sealed class RsvpEntity
{
    [JsonPropertyName("PK")]          public string PK          { get; set; } = default!;
    [JsonPropertyName("SK")]          public string SK          { get; set; } = default!;
    [JsonPropertyName("GSI1PK")]      public string GSI1PK      { get; set; } = default!;
    [JsonPropertyName("GSI1SK")]      public string GSI1SK      { get; set; } = default!;
    [JsonPropertyName("eventId")]     public string EventId     { get; set; } = default!;
    [JsonPropertyName("guestEmail")]  public string GuestEmail  { get; set; } = default!;
    [JsonPropertyName("guestName")]   public string GuestName   { get; set; } = default!;
    [JsonPropertyName("status")]      public string Status      { get; set; } = "pending";
    [JsonPropertyName("plusOnes")]    public int    PlusOnes    { get; set; } = 0;
    [JsonPropertyName("message")]     public string? Message    { get; set; }
    [JsonPropertyName("respondedAt")] public string? RespondedAt { get; set; }
    [JsonPropertyName("createdAt")]   public string CreatedAt   { get; set; } = default!;
    [JsonPropertyName("updatedAt")]   public string UpdatedAt   { get; set; } = default!;
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public sealed class CreateEventRequest
{
    [JsonPropertyName("title")]       public string  Title       { get; set; } = default!;
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("eventDate")]   public string  EventDate   { get; set; } = default!;
    [JsonPropertyName("endDate")]     public string? EndDate     { get; set; }
    [JsonPropertyName("location")]    public string? Location    { get; set; }
    [JsonPropertyName("address")]     public string? Address     { get; set; }
    [JsonPropertyName("capacity")]    public int?    Capacity    { get; set; }
    [JsonPropertyName("tags")]        public List<string>? Tags  { get; set; }
    [JsonPropertyName("rsvpDeadline")] public string? RsvpDeadline { get; set; }
}

public sealed class UpdateEventRequest
{
    [JsonPropertyName("title")]       public string?  Title       { get; set; }
    [JsonPropertyName("description")] public string?  Description { get; set; }
    [JsonPropertyName("eventDate")]   public string?  EventDate   { get; set; }
    [JsonPropertyName("endDate")]     public string?  EndDate     { get; set; }
    [JsonPropertyName("location")]    public string?  Location    { get; set; }
    [JsonPropertyName("address")]     public string?  Address     { get; set; }
    [JsonPropertyName("capacity")]    public int?     Capacity    { get; set; }
    [JsonPropertyName("tags")]        public List<string>? Tags   { get; set; }
    [JsonPropertyName("rsvpDeadline")] public string? RsvpDeadline { get; set; }
    [JsonPropertyName("status")]      public string?  Status      { get; set; }
    [JsonPropertyName("coverImageUrl")] public string? CoverImageUrl { get; set; }
}

public sealed class PublishEventRequest
{
    [JsonPropertyName("micrositeSlug")] public string MicrositeSlug { get; set; } = default!;
}

public sealed class SubmitRsvpRequest
{
    [JsonPropertyName("guestEmail")]    public string GuestEmail    { get; set; } = default!;
    [JsonPropertyName("guestName")]     public string GuestName     { get; set; } = default!;
    [JsonPropertyName("status")]        public string Status        { get; set; } = default!;
    [JsonPropertyName("plusOnes")]      public int    PlusOnes      { get; set; } = 0;
    [JsonPropertyName("message")]       public string? Message      { get; set; }
    [JsonPropertyName("recaptchaToken")] public string RecaptchaToken { get; set; } = default!;
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

public sealed class RsvpSummary
{
    [JsonPropertyName("total")]          public int Total          { get; set; }
    [JsonPropertyName("yes")]            public int Yes            { get; set; }
    [JsonPropertyName("no")]             public int No             { get; set; }
    [JsonPropertyName("maybe")]          public int Maybe          { get; set; }
    [JsonPropertyName("pending")]        public int Pending        { get; set; }
    [JsonPropertyName("totalAttending")] public int TotalAttending { get; set; }
}

public sealed class PaginatedResult<T>
{
    [JsonPropertyName("items")]      public List<T> Items      { get; set; } = [];
    [JsonPropertyName("nextCursor")] public string? NextCursor { get; set; }
    [JsonPropertyName("total")]      public int?    Total      { get; set; }
}

public sealed class ApiResponse<T>
{
    [JsonPropertyName("success")] public bool    Success { get; set; }
    [JsonPropertyName("data")]    public T?      Data    { get; set; }
    [JsonPropertyName("error")]   public string? Error   { get; set; }
    [JsonPropertyName("code")]    public string? Code    { get; set; }

    public static ApiResponse<T> Ok(T data)
        => new() { Success = true, Data = data };

    public static ApiResponse<T> Fail(string error, string? code = null)
        => new() { Success = false, Error = error, Code = code };
}
