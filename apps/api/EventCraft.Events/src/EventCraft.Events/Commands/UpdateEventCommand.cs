namespace EventCraft.Events.Commands;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

public sealed record UpdateEventCommand(
    string             EventId,
    string             UserId,
    UpdateEventRequest Request
) : IRequest<Result<EventEntity>>;

public sealed class UpdateEventCommandHandler : IRequestHandler<UpdateEventCommand, Result<EventEntity>>
{
    private readonly IEventRepository _repo;
    private readonly ILogger<UpdateEventCommandHandler> _log;

    public UpdateEventCommandHandler(IEventRepository repo, ILogger<UpdateEventCommandHandler> log)
    {
        _repo = repo;
        _log  = log;
    }

    public async Task<Result<EventEntity>> Handle(UpdateEventCommand cmd, CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(cmd.EventId, ct);
        if (existing.IsFailure) return existing;

        var entity = existing.Value!;

        if (entity.UserId != cmd.UserId)
            return Result<EventEntity>.Unauthorized("You do not own this event");

        var req = cmd.Request;
        if (req.Title        is not null) entity.Title        = req.Title.Trim();
        if (req.Description  is not null) entity.Description  = req.Description.Trim();
        if (req.EventDate    is not null) entity.EventDate    = req.EventDate;
        if (req.EndDate      is not null) entity.EndDate      = req.EndDate;
        if (req.Location     is not null) entity.Location     = req.Location.Trim();
        if (req.Address      is not null) entity.Address      = req.Address.Trim();
        if (req.Capacity     is not null) entity.Capacity     = req.Capacity;
        if (req.Tags         is not null) entity.Tags         = req.Tags;
        if (req.RsvpDeadline is not null) entity.RsvpDeadline = req.RsvpDeadline;
        if (req.CoverImageUrl is not null) entity.CoverImageUrl = req.CoverImageUrl;

        return await _repo.UpdateAsync(entity, ct);
    }
}
