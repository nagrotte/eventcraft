using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;

namespace EventCraft.Events.Queries;

public record GetEventQuery(string EventId, string? UserId) : IRequest<EventEntity?>;

public class GetEventQueryHandler : IRequestHandler<GetEventQuery, EventEntity?>
{
  private readonly IEventRepository _repo;

  public GetEventQueryHandler(IEventRepository repo) => _repo = repo;

  public async Task<EventEntity?> Handle(GetEventQuery query, CancellationToken ct)
  {
    var entity = await _repo.GetByIdAsync(query.EventId, ct);
    if (entity is null) return null;

    // Non-owners can only see published events
    if (entity.UserId != query.UserId && entity.Status != "published")
      return null;

    return entity;
  }
}
