namespace EventCraft.Events.Queries;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;

public sealed record ListEventsQuery(
    string  UserId,
    int     Limit  = 20,
    string? Cursor = null
) : IRequest<Result<PaginatedResult<EventEntity>>>;

public sealed class ListEventsQueryHandler
    : IRequestHandler<ListEventsQuery, Result<PaginatedResult<EventEntity>>>
{
    private readonly IEventRepository _repo;

    public ListEventsQueryHandler(IEventRepository repo) => _repo = repo;

    public async Task<Result<PaginatedResult<EventEntity>>> Handle(ListEventsQuery query, CancellationToken ct)
    {
        var limit = Math.Clamp(query.Limit, 1, 100);
        return await _repo.ListByUserAsync(query.UserId, limit, query.Cursor, ct);
    }
}
