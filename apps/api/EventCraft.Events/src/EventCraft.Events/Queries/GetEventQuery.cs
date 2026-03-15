namespace EventCraft.Events.Queries;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;

public sealed record GetEventQuery(string EventId, string? UserId = null) : IRequest<Result<EventEntity>>;

public sealed class GetEventQueryHandler : IRequestHandler<GetEventQuery, Result<EventEntity>>
{
    private readonly IEventRepository _repo;

    public GetEventQueryHandler(IEventRepository repo) => _repo = repo;

    public async Task<Result<EventEntity>> Handle(GetEventQuery query, CancellationToken ct)
    {
        var result = await _repo.GetByIdAsync(query.EventId, ct);

        if (result.IsFailure) return result;

        // Non-owners can only see published events
        var ev = result.Value!;
        if (ev.UserId != query.UserId && ev.Status != "published")
            return Result<EventEntity>.NotFound("Event not found");

        return result;
    }
}
