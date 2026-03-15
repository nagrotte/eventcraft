namespace EventCraft.Events.Repositories;

using EventCraft.Events.Models;

public interface IEventRepository
{
    Task<Result<EventEntity>>                  GetByIdAsync(string eventId, CancellationToken ct = default);
    Task<Result<EventEntity>>                  GetBySlugAsync(string slug, CancellationToken ct = default);
    Task<Result<PaginatedResult<EventEntity>>> ListByUserAsync(string userId, int limit, string? cursor, CancellationToken ct = default);
    Task<Result<EventEntity>>                  CreateAsync(EventEntity entity, CancellationToken ct = default);
    Task<Result<EventEntity>>                  UpdateAsync(EventEntity entity, CancellationToken ct = default);
    Task<Result>                               DeleteAsync(string eventId, string userId, CancellationToken ct = default);
}

public interface IRsvpRepository
{
    Task<Result<RsvpEntity>>                   GetAsync(string eventId, string guestEmail, CancellationToken ct = default);
    Task<Result<RsvpEntity>>                   UpsertAsync(RsvpEntity entity, CancellationToken ct = default);
    Task<Result<PaginatedResult<RsvpEntity>>>  ListByEventAsync(string eventId, int limit, string? cursor, CancellationToken ct = default);
    Task<Result<RsvpSummary>>                  GetSummaryAsync(string eventId, CancellationToken ct = default);
}
