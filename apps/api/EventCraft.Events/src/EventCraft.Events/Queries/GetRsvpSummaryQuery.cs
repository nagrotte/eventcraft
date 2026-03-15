namespace EventCraft.Events.Queries;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;

public sealed record GetRsvpSummaryQuery(string EventId, string UserId) : IRequest<Result<RsvpSummary>>;

public sealed class GetRsvpSummaryQueryHandler : IRequestHandler<GetRsvpSummaryQuery, Result<RsvpSummary>>
{
    private readonly IEventRepository _eventRepo;
    private readonly IRsvpRepository  _rsvpRepo;

    public GetRsvpSummaryQueryHandler(IEventRepository eventRepo, IRsvpRepository rsvpRepo)
    {
        _eventRepo = eventRepo;
        _rsvpRepo  = rsvpRepo;
    }

    public async Task<Result<RsvpSummary>> Handle(GetRsvpSummaryQuery query, CancellationToken ct)
    {
        var ev = await _eventRepo.GetByIdAsync(query.EventId, ct);
        if (ev.IsFailure) return Result<RsvpSummary>.NotFound("Event not found");

        if (ev.Value!.UserId != query.UserId)
            return Result<RsvpSummary>.Unauthorized("Access denied");

        return await _rsvpRepo.GetSummaryAsync(query.EventId, ct);
    }
}
