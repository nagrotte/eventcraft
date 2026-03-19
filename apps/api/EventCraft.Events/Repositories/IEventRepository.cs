using EventCraft.Events.Models;

namespace EventCraft.Events.Repositories;

public interface IEventRepository
{
    Task<EventEntity?>                  GetByIdAsync(string eventId, CancellationToken ct = default);
    Task<PaginatedResponse<EventEntity>> ListByUserAsync(string userId, int limit, string? cursor, CancellationToken ct = default);
    Task<EventEntity>                   CreateAsync(EventEntity entity, CancellationToken ct = default);
    Task<EventEntity>                   UpdateAsync(EventEntity entity, CancellationToken ct = default);
    Task                                DeleteAsync(string eventId, CancellationToken ct = default);
    Task                                SaveRsvpAsync(string eventId, RsvpRequest rsvp, CancellationToken ct = default);
    Task<List<RsvpEntity>>              ListRsvpsAsync(string eventId, CancellationToken ct = default);
}
