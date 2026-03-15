namespace EventCraft.Events.Commands;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;

public sealed record PublishEventCommand(
    string               EventId,
    string               UserId,
    PublishEventRequest  Request
) : IRequest<Result<EventEntity>>;

public sealed class PublishEventCommandHandler : IRequestHandler<PublishEventCommand, Result<EventEntity>>
{
    private readonly IEventRepository _repo;

    public PublishEventCommandHandler(IEventRepository repo) => _repo = repo;

    public async Task<Result<EventEntity>> Handle(PublishEventCommand cmd, CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(cmd.EventId, ct);
        if (existing.IsFailure) return existing;

        var entity = existing.Value!;

        if (entity.UserId != cmd.UserId)
            return Result<EventEntity>.Unauthorized("You do not own this event");

        if (string.IsNullOrWhiteSpace(cmd.Request.MicrositeSlug))
            return Result<EventEntity>.Fail("Microsite slug is required", "VALIDATION_ERROR");

        entity.Status        = "published";
        entity.MicrositeSlug = cmd.Request.MicrositeSlug.ToLowerInvariant().Trim();

        return await _repo.UpdateAsync(entity, ct);
    }
}
