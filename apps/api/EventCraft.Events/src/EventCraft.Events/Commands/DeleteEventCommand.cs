namespace EventCraft.Events.Commands;

using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;

public sealed record DeleteEventCommand(string EventId, string UserId) : IRequest<Result>;

public sealed class DeleteEventCommandHandler : IRequestHandler<DeleteEventCommand, Result>
{
    private readonly IEventRepository _repo;

    public DeleteEventCommandHandler(IEventRepository repo) => _repo = repo;

    public async Task<Result> Handle(DeleteEventCommand cmd, CancellationToken ct)
    {
        var existing = await _repo.GetByIdAsync(cmd.EventId, ct);
        if (existing.IsFailure)
            return Result.NotFound($"Event {cmd.EventId} not found");

        if (existing.Value!.UserId != cmd.UserId)
            return Result.Fail("You do not own this event", "UNAUTHORIZED", 401);

        return await _repo.DeleteAsync(cmd.EventId, cmd.UserId, ct);
    }
}
