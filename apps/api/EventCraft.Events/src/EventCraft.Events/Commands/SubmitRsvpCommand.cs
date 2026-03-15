namespace EventCraft.Events.Commands;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

public sealed record SubmitRsvpCommand(
    string           EventId,
    SubmitRsvpRequest Request
) : IRequest<Result<RsvpEntity>>;

public sealed class SubmitRsvpCommandHandler : IRequestHandler<SubmitRsvpCommand, Result<RsvpEntity>>
{
    private readonly IEventRepository _eventRepo;
    private readonly IRsvpRepository  _rsvpRepo;
    private readonly ILogger<SubmitRsvpCommandHandler> _log;

    public SubmitRsvpCommandHandler(
        IEventRepository eventRepo,
        IRsvpRepository  rsvpRepo,
        ILogger<SubmitRsvpCommandHandler> log)
    {
        _eventRepo = eventRepo;
        _rsvpRepo  = rsvpRepo;
        _log       = log;
    }

    public async Task<Result<RsvpEntity>> Handle(SubmitRsvpCommand cmd, CancellationToken ct)
    {
        var req = cmd.Request;

        if (string.IsNullOrWhiteSpace(req.GuestEmail))
            return Result<RsvpEntity>.Fail("Email is required", "VALIDATION_ERROR");

        if (string.IsNullOrWhiteSpace(req.GuestName))
            return Result<RsvpEntity>.Fail("Name is required", "VALIDATION_ERROR");

        var validStatuses = new[] { "yes", "no", "maybe" };
        if (!validStatuses.Contains(req.Status))
            return Result<RsvpEntity>.Fail("Status must be yes, no, or maybe", "VALIDATION_ERROR");

        // Verify the event exists and is published
        var eventResult = await _eventRepo.GetByIdAsync(cmd.EventId, ct);
        if (eventResult.IsFailure)
            return Result<RsvpEntity>.NotFound("Event not found");

        if (eventResult.Value!.Status != "published")
            return Result<RsvpEntity>.Fail("Event is not accepting RSVPs", "EVENT_NOT_PUBLISHED");

        var now    = DateTime.UtcNow.ToString("O");
        var entity = new RsvpEntity
        {
            EventId     = cmd.EventId,
            GuestEmail  = req.GuestEmail.ToLowerInvariant().Trim(),
            GuestName   = req.GuestName.Trim(),
            Status      = req.Status,
            PlusOnes    = Math.Max(0, req.PlusOnes),
            Message     = req.Message?.Trim(),
            RespondedAt = now,
            CreatedAt   = now,
            UpdatedAt   = now
        };

        return await _rsvpRepo.UpsertAsync(entity, ct);
    }
}
