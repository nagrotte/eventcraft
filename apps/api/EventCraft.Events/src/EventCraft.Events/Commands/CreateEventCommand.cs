namespace EventCraft.Events.Commands;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

public sealed record CreateEventCommand(
    string             UserId,
    CreateEventRequest Request
) : IRequest<Result<EventEntity>>;

public sealed class CreateEventCommandHandler : IRequestHandler<CreateEventCommand, Result<EventEntity>>
{
    private readonly IEventRepository _repo;
    private readonly ILogger<CreateEventCommandHandler> _log;

    public CreateEventCommandHandler(IEventRepository repo, ILogger<CreateEventCommandHandler> log)
    {
        _repo = repo;
        _log  = log;
    }

    public async Task<Result<EventEntity>> Handle(CreateEventCommand cmd, CancellationToken ct)
    {
        var req = cmd.Request;

        if (string.IsNullOrWhiteSpace(req.Title))
            return Result<EventEntity>.Fail("Title is required", "VALIDATION_ERROR");

        if (string.IsNullOrWhiteSpace(req.EventDate))
            return Result<EventEntity>.Fail("Event date is required", "VALIDATION_ERROR");

        var now    = DateTime.UtcNow.ToString("O");
        var entity = new EventEntity
        {
            EventId     = $"evt_{Guid.NewGuid():N}",
            UserId      = cmd.UserId,
            Title       = req.Title.Trim(),
            Description = req.Description?.Trim(),
            EventDate   = req.EventDate,
            EndDate     = req.EndDate,
            Location    = req.Location?.Trim(),
            Address     = req.Address?.Trim(),
            Capacity    = req.Capacity,
            Status      = "draft",
            Tags        = req.Tags ?? [],
            RsvpDeadline = req.RsvpDeadline,
            CreatedAt   = now,
            UpdatedAt   = now
        };

        return await _repo.CreateAsync(entity, ct);
    }
}
