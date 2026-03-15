namespace EventCraft.Events.Repositories;

using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using EventCraft.Events.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

/// <summary>
/// DynamoDB implementation of IEventRepository.
/// Single-table design — all access patterns via PK/SK/GSI.
/// One class per file. No inline SQL/queries. Repository pattern.
/// </summary>
public sealed class DynamoEventRepository : IEventRepository
{
    private readonly IAmazonDynamoDB  _dynamo;
    private readonly ILogger<DynamoEventRepository> _log;
    private readonly string           _tableName;

    // ── DynamoDB key helpers ──────────────────────────────────────────────────
    private static string EventPK(string eventId)  => $"EVENT#{eventId}";
    private const  string EventSK                   = "METADATA";
    private static string UserGsi1Pk(string userId) => $"USER#{userId}";

    public DynamoEventRepository(
        IAmazonDynamoDB dynamo,
        ILogger<DynamoEventRepository> log,
        string tableName)
    {
        _dynamo    = dynamo;
        _log       = log;
        _tableName = tableName;
    }

    // ── GetByIdAsync ──────────────────────────────────────────────────────────
    public async Task<Result<EventEntity>> GetByIdAsync(string eventId, CancellationToken ct = default)
    {
        try
        {
            var response = await _dynamo.GetItemAsync(new GetItemRequest
            {
                TableName = _tableName,
                Key = new Dictionary<string, AttributeValue>
                {
                    ["PK"] = new() { S = EventPK(eventId) },
                    ["SK"] = new() { S = EventSK }
                }
            }, ct);

            if (!response.IsItemSet)
                return Result<EventEntity>.NotFound($"Event {eventId} not found");

            return Result<EventEntity>.Ok(MapToEntity(response.Item));
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "GetByIdAsync failed for eventId={EventId}", eventId);
            return Result<EventEntity>.ServerError();
        }
    }

    // ── GetBySlugAsync ────────────────────────────────────────────────────────
    public async Task<Result<EventEntity>> GetBySlugAsync(string slug, CancellationToken ct = default)
    {
        try
        {
            var response = await _dynamo.QueryAsync(new QueryRequest
            {
                TableName              = _tableName,
                IndexName              = "GSI2",
                KeyConditionExpression = "GSI2PK = :slug",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":slug"] = new() { S = $"SLUG#{slug}" }
                },
                Limit = 1
            }, ct);

            if (response.Items.Count == 0)
                return Result<EventEntity>.NotFound($"Event with slug '{slug}' not found");

            return Result<EventEntity>.Ok(MapToEntity(response.Items[0]));
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "GetBySlugAsync failed for slug={Slug}", slug);
            return Result<EventEntity>.ServerError();
        }
    }

    // ── ListByUserAsync ───────────────────────────────────────────────────────
    public async Task<Result<PaginatedResult<EventEntity>>> ListByUserAsync(
        string userId, int limit, string? cursor, CancellationToken ct = default)
    {
        try
        {
            var request = new QueryRequest
            {
                TableName              = _tableName,
                IndexName              = "GSI1",
                KeyConditionExpression = "GSI1PK = :userId AND begins_with(GSI1SK, :prefix)",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":userId"] = new() { S = UserGsi1Pk(userId) },
                    [":prefix"] = new() { S = "EVENT#" }
                },
                ScanIndexForward = false,   // newest first
                Limit            = limit
            };

            // Decode cursor for pagination
            if (!string.IsNullOrEmpty(cursor))
            {
                var decoded = JsonSerializer.Deserialize<Dictionary<string, string>>(
                    Convert.FromBase64String(cursor));
                if (decoded is not null)
                {
                    request.ExclusiveStartKey = decoded.ToDictionary(
                        kvp => kvp.Key,
                        kvp => new AttributeValue { S = kvp.Value });
                }
            }

            var response = await _dynamo.QueryAsync(request, ct);

            // Encode next cursor
            string? nextCursor = null;
            if (response.LastEvaluatedKey?.Count > 0)
            {
                var cursorData = response.LastEvaluatedKey
                    .ToDictionary(kvp => kvp.Key, kvp => kvp.Value.S);
                nextCursor = Convert.ToBase64String(
                    JsonSerializer.SerializeToUtf8Bytes(cursorData));
            }

            return Result<PaginatedResult<EventEntity>>.Ok(new PaginatedResult<EventEntity>
            {
                Items      = response.Items.Select(MapToEntity).ToList(),
                NextCursor = nextCursor
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "ListByUserAsync failed for userId={UserId}", userId);
            return Result<PaginatedResult<EventEntity>>.ServerError();
        }
    }

    // ── CreateAsync ───────────────────────────────────────────────────────────
    public async Task<Result<EventEntity>> CreateAsync(EventEntity entity, CancellationToken ct = default)
    {
        try
        {
            var item = MapToAttributes(entity);

            await _dynamo.PutItemAsync(new PutItemRequest
            {
                TableName           = _tableName,
                Item                = item,
                ConditionExpression = "attribute_not_exists(PK)"   // prevent overwrite
            }, ct);

            _log.LogInformation("Event created: {EventId} by {UserId}", entity.EventId, entity.UserId);
            return Result<EventEntity>.Created(entity);
        }
        catch (ConditionalCheckFailedException)
        {
            return Result<EventEntity>.Fail("Event already exists", "CONFLICT", 409);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "CreateAsync failed for eventId={EventId}", entity.EventId);
            return Result<EventEntity>.ServerError();
        }
    }

    // ── UpdateAsync ───────────────────────────────────────────────────────────
    public async Task<Result<EventEntity>> UpdateAsync(EventEntity entity, CancellationToken ct = default)
    {
        try
        {
            entity.UpdatedAt = DateTime.UtcNow.ToString("O");
            var item = MapToAttributes(entity);

            await _dynamo.PutItemAsync(new PutItemRequest
            {
                TableName           = _tableName,
                Item                = item,
                ConditionExpression = "attribute_exists(PK)"   // must already exist
            }, ct);

            _log.LogInformation("Event updated: {EventId}", entity.EventId);
            return Result<EventEntity>.Ok(entity);
        }
        catch (ConditionalCheckFailedException)
        {
            return Result<EventEntity>.NotFound($"Event {entity.EventId} not found");
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "UpdateAsync failed for eventId={EventId}", entity.EventId);
            return Result<EventEntity>.ServerError();
        }
    }

    // ── DeleteAsync ───────────────────────────────────────────────────────────
    public async Task<Result> DeleteAsync(string eventId, string userId, CancellationToken ct = default)
    {
        try
        {
            await _dynamo.DeleteItemAsync(new DeleteItemRequest
            {
                TableName           = _tableName,
                Key = new Dictionary<string, AttributeValue>
                {
                    ["PK"] = new() { S = EventPK(eventId) },
                    ["SK"] = new() { S = EventSK }
                },
                ConditionExpression        = "userId = :userId",
                ExpressionAttributeValues  = new Dictionary<string, AttributeValue>
                {
                    [":userId"] = new() { S = userId }
                }
            }, ct);

            _log.LogInformation("Event deleted: {EventId}", eventId);
            return Result.NoContent();
        }
        catch (ConditionalCheckFailedException)
        {
            return Result.Fail("Event not found or access denied", "NOT_FOUND", 404);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "DeleteAsync failed for eventId={EventId}", eventId);
            return Result.ServerError();
        }
    }

    // ── Mapping: DynamoDB attributes <-> EventEntity ──────────────────────────

    private static EventEntity MapToEntity(Dictionary<string, AttributeValue> item)
        => new()
        {
            PK             = item["PK"].S,
            SK             = item["SK"].S,
            GSI1PK         = item.TryGetValue("GSI1PK", out var g1pk) ? g1pk.S : "",
            GSI1SK         = item.TryGetValue("GSI1SK", out var g1sk) ? g1sk.S : "",
            EventId        = item["eventId"].S,
            UserId         = item["userId"].S,
            Title          = item["title"].S,
            Description    = item.TryGetValue("description", out var desc) ? desc.S : null,
            EventDate      = item["eventDate"].S,
            EndDate        = item.TryGetValue("endDate", out var ed) ? ed.S : null,
            Location       = item.TryGetValue("location", out var loc) ? loc.S : null,
            Address        = item.TryGetValue("address", out var addr) ? addr.S : null,
            Capacity       = item.TryGetValue("capacity", out var cap) && int.TryParse(cap.N, out var capVal) ? capVal : null,
            Status         = item["status"].S,
            MicrositeSlug  = item.TryGetValue("micrositeSlug", out var slug) ? slug.S : null,
            DesignId       = item.TryGetValue("designId", out var did) ? did.S : null,
            CoverImageUrl  = item.TryGetValue("coverImageUrl", out var img) ? img.S : null,
            Tags           = item.TryGetValue("tags", out var tags) ? tags.SS : [],
            RsvpDeadline   = item.TryGetValue("rsvpDeadline", out var rd) ? rd.S : null,
            CreatedAt      = item["createdAt"].S,
            UpdatedAt      = item["updatedAt"].S
        };

    private static Dictionary<string, AttributeValue> MapToAttributes(EventEntity e)
    {
        var item = new Dictionary<string, AttributeValue>
        {
            ["PK"]        = new() { S = EventPK(e.EventId) },
            ["SK"]        = new() { S = EventSK },
            ["GSI1PK"]    = new() { S = UserGsi1Pk(e.UserId) },
            ["GSI1SK"]    = new() { S = $"EVENT#{e.EventId}" },
            ["eventId"]   = new() { S = e.EventId },
            ["userId"]    = new() { S = e.UserId },
            ["title"]     = new() { S = e.Title },
            ["eventDate"] = new() { S = e.EventDate },
            ["status"]    = new() { S = e.Status },
            ["createdAt"] = new() { S = e.CreatedAt },
            ["updatedAt"] = new() { S = e.UpdatedAt }
        };

        if (e.Description    is not null) item["description"]   = new() { S = e.Description };
        if (e.EndDate        is not null) item["endDate"]        = new() { S = e.EndDate };
        if (e.Location       is not null) item["location"]       = new() { S = e.Location };
        if (e.Address        is not null) item["address"]        = new() { S = e.Address };
        if (e.Capacity       is not null) item["capacity"]       = new() { N = e.Capacity.ToString() };
        if (e.MicrositeSlug  is not null)
        {
            item["micrositeSlug"]  = new() { S = e.MicrositeSlug };
            item["GSI2PK"]         = new() { S = $"SLUG#{e.MicrositeSlug}" };
        }
        if (e.DesignId       is not null) item["designId"]       = new() { S = e.DesignId };
        if (e.CoverImageUrl  is not null) item["coverImageUrl"]  = new() { S = e.CoverImageUrl };
        if (e.Tags?.Count    > 0)         item["tags"]           = new() { SS = e.Tags };
        if (e.RsvpDeadline   is not null) item["rsvpDeadline"]   = new() { S = e.RsvpDeadline };

        return item;
    }
}
