using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace EventCraft.Events.Commands;

public record UpdateEventCommand(string EventId, string UserId, UpdateEventRequest Request) : IRequest<EventEntity?>;

public class UpdateEventCommandHandler : IRequestHandler<UpdateEventCommand, EventEntity?>
{
    private readonly IEventRepository                  _repo;
    private readonly ILogger<UpdateEventCommandHandler> _log;

    public UpdateEventCommandHandler(IEventRepository repo, ILogger<UpdateEventCommandHandler> log)
    {
        _repo = repo;
        _log  = log;
    }

    public async Task<EventEntity?> Handle(UpdateEventCommand cmd, CancellationToken ct)
    {
        var entity = await _repo.GetByIdAsync(cmd.EventId, ct);
        if (entity is null) return null;
        if (entity.UserId != cmd.UserId) return null;

        var req = cmd.Request;

        // Core event details
        if (req.Title        is not null) entity.Title       = req.Title.Trim();
        if (req.Description  is not null) entity.Description = req.Description.Trim();
        if (req.EventDate    is not null) entity.EventDate   = req.EventDate;
        if (req.EndDate      is not null) entity.EndDate     = req.EndDate;
        if (req.Location     is not null) entity.Location    = req.Location.Trim();
        if (req.Address      is not null) entity.Address     = req.Address.Trim();
        if (req.Capacity     is not null) entity.Capacity    = req.Capacity;
        if (req.Tags         is not null) entity.Tags        = req.Tags;
        if (req.RsvpDeadline is not null) entity.RsvpDeadline = req.RsvpDeadline;
        if (req.CoverImageUrl is not null) entity.CoverImageUrl = req.CoverImageUrl;
        if (req.Status       is not null) entity.Status      = req.Status;

        // Microsite / organizer / schedule / gallery — previously missing
        if (req.MicrositeSlug  is not null) entity.MicrositeSlug  = req.MicrositeSlug.Trim();
        if (req.OrganizerName  is not null) entity.OrganizerName  = req.OrganizerName.Trim();
        if (req.OrganizerPhone is not null) entity.OrganizerPhone = req.OrganizerPhone.Trim();
        if (req.OrganizerEmail is not null) entity.OrganizerEmail = req.OrganizerEmail.Trim();
        if (req.Schedule       is not null) entity.Schedule       = req.Schedule;
        if (req.GalleryUrl     is not null) entity.GalleryUrl     = req.GalleryUrl.Trim();

        _log.LogInformation("Event updated: {EventId} by {UserId}", cmd.EventId, cmd.UserId);
        return await _repo.UpdateAsync(entity, ct);
    }
}
