using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace EventCraft.Events.Commands;

public record CreateEventCommand(string UserId, CreateEventRequest Request) : IRequest<EventEntity>;

public class CreateEventCommandHandler : IRequestHandler<CreateEventCommand, EventEntity>
{
  private readonly IEventRepository _repo;
  private readonly ILogger<CreateEventCommandHandler> _log;

  public CreateEventCommandHandler(IEventRepository repo, ILogger<CreateEventCommandHandler> log)
  {
    _repo = repo;
    _log = log;
  }

  public async Task<EventEntity> Handle(CreateEventCommand cmd, CancellationToken ct)
  {
    var now = DateTime.UtcNow.ToString("O");
    var entity = new EventEntity
    {
      EventId = $"evt_{Guid.NewGuid():N}",
      UserId = cmd.UserId,
      Title = cmd.Request.Title.Trim(),
      Description = cmd.Request.Description?.Trim(),
      EventDate = cmd.Request.EventDate,
      EndDate = cmd.Request.EndDate,
      Location = cmd.Request.Location?.Trim(),
      Address = cmd.Request.Address?.Trim(),
      Capacity = cmd.Request.Capacity,
      Status = "draft",
      Tags = cmd.Request.Tags ?? new(),
      RsvpDeadline = cmd.Request.RsvpDeadline,
      CreatedAt = now,
      UpdatedAt = now
    };

    return await _repo.CreateAsync(entity, ct);
  }
}
