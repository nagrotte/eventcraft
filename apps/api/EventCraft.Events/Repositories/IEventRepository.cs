using EventCraft.Events.Models;
namespace EventCraft.Events.Repositories;
public interface IEventRepository
{
    Task<EventEntity?>                   GetByIdAsync(string eventId, CancellationToken ct = default);
    Task<EventEntity?>                   GetBySlugAsync(string slug, CancellationToken ct = default);
    Task<PaginatedResponse<EventEntity>> ListByUserAsync(string userId, int limit, string? cursor, CancellationToken ct = default);
    Task<EventEntity>                    CreateAsync(EventEntity entity, CancellationToken ct = default);
    Task<EventEntity>                    UpdateAsync(EventEntity entity, CancellationToken ct = default);
    Task                                 DeleteAsync(string eventId, CancellationToken ct = default);
    Task                                 SaveRsvpAsync(string eventId, RsvpRequest rsvp, CancellationToken ct = default);
    Task<List<RsvpEntity>>               ListRsvpsAsync(string eventId, CancellationToken ct = default);
    Task<List<RsvpEntity>>               ListRsvpsByResponseAsync(string eventId, IEnumerable<string> responses, CancellationToken ct = default);
    Task                                 DeleteRsvpAsync(string eventId, string rsvpId, CancellationToken ct = default);
    Task<List<ContactEntity>>            ListContactsAsync(string userId, CancellationToken ct = default);
    Task<ContactEntity>                  CreateContactAsync(string userId, CreateContactRequest req, CancellationToken ct = default);
    Task                                 DeleteContactAsync(string userId, string contactId, CancellationToken ct = default);
    Task<List<CuratedImageEntity>>       ListCuratedAsync(CancellationToken ct = default);
    Task<CuratedImageEntity>             CreateCuratedAsync(CuratedImageEntity entity, CancellationToken ct = default);
    Task                                 DeleteCuratedAsync(string imageId, CancellationToken ct = default);
    Task<EventEntity>                    DuplicateEventAsync(string eventId, string newUserId, CancellationToken ct = default);
    Task<RsvpEntity?>                    CheckinRsvpAsync(string eventId, string rsvpId, CancellationToken ct = default);
    Task<ReminderLog>                    SaveReminderLogAsync(ReminderLog log, CancellationToken ct = default);
    Task<List<ReminderLog>>              ListReminderLogsAsync(string eventId, CancellationToken ct = default);
}
