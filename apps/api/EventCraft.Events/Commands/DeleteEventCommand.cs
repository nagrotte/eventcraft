using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace EventCraft.Events.Commands;

public record DeleteEventCommand(string EventId, string UserId) : IRequest<bool>;

public class DeleteEventCommandHandler : IRequestHandler<DeleteEventCommand, bool>
{
  private readonly IEventRepository _repo;
  private readonly ILogger<DeleteEventCommandHandler> _log;

  public DeleteEventCommandHandler(IEventRepository repo, ILogger<DeleteEventCommandHandler> log)
  {
    _repo = repo;
    _log = log;
  }

  public async Task<bool> Handle(DeleteEventCommand cmd, CancellationToken ct)
  {
    var entity = await _repo.GetByIdAsync(cmd.EventId, ct);
    if (entity is null) return false;
    if (entity.UserId != cmd.UserId) return false;

    await _repo.DeleteAsync(cmd.EventId, ct);
    return true;
  }
}
