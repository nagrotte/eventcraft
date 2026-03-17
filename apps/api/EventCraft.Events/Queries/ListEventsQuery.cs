using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;

namespace EventCraft.Events.Queries;

public record ListEventsQuery(string UserId, int Limit, string? Cursor) : IRequest<PaginatedResponse<EventEntity>>;

public class ListEventsQueryHandler : IRequestHandler<ListEventsQuery, PaginatedResponse<EventEntity>>
{
  private readonly IEventRepository _repo;

  public ListEventsQueryHandler(IEventRepository repo) => _repo = repo;

  public async Task<PaginatedResponse<EventEntity>> Handle(ListEventsQuery query, CancellationToken ct)
  {
    var limit = Math.Clamp(query.Limit, 1, 100);
    return await _repo.ListByUserAsync(query.UserId, limit, query.Cursor, ct);
  }
}
