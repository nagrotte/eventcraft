namespace EventCraft.Events.Models;

public class ContactEntity
{
    public string  ContactId { get; set; } = string.Empty;
    public string  UserId    { get; set; } = string.Empty;
    public string  Name      { get; set; } = string.Empty;
    public string? Email     { get; set; }
    public string? Phone     { get; set; }
    public string  CreatedAt { get; set; } = string.Empty;
}

public class CreateContactRequest
{
    public string  Name  { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class SendInviteRequest
{
    public List<string> ContactIds { get; set; } = new();
}
