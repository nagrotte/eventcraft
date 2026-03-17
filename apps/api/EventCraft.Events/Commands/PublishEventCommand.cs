using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace EventCraft.Events.Commands;

public record PublishEventCommand(string EventId, string UserId, string MicrositeSlug) : IRequest<EventEntity?>;

public class PublishEventCommandHandler : IRequestHandler<PublishEventCommand, EventEntity?>
{
  private readonly IEventRepository _repo;
  private readonly ILogger<PublishEventCommandHandler> _log;

  public PublishEventCommandHandler(IEventRepository repo, ILogger<PublishEventCommandHandler> log)
  {
    _repo = repo;
    _log = log;
  }

  public async Task<EventEntity?> Handle(PublishEventCommand cmd, CancellationToken ct)
  {
    var entity = await _repo.GetByIdAsync(cmd.EventId, ct);
    if (entity is null) return null;
    if (entity.UserId != cmd.UserId) return null;

    entity.Status = "published";
    entity.MicrositeSlug = cmd.MicrositeSlug.ToLowerInvariant().Trim();

    return await _repo.UpdateAsync(entity, ct);
  }
}
