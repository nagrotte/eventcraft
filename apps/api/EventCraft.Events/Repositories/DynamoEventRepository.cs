using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using EventCraft.Events.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace EventCraft.Events.Repositories;

public class DynamoEventRepository : IEventRepository
{
    private readonly IAmazonDynamoDB _dynamo;
    private readonly ILogger<DynamoEventRepository> _log;
    private readonly string _table;

    private static string PK(string eventId) => $"EVENT#{eventId}";
    private const string SK = "METADATA";

    public DynamoEventRepository(IAmazonDynamoDB dynamo, ILogger<DynamoEventRepository> log, string table)
    {
        _dynamo = dynamo;
        _log    = log;
        _table  = table;
    }

    public async Task<EventEntity?> GetByIdAsync(string eventId, CancellationToken ct = default)
    {
        var response = await _dynamo.GetItemAsync(new GetItemRequest
        {
            TableName = _table,
            Key = new Dictionary<string, AttributeValue>
            {
                ["PK"] = new() { S = PK(eventId) },
                ["SK"] = new() { S = SK }
            }
        }, ct);

        if (!response.IsItemSet) return null;
        return Map(response.Item);
    }

    public async Task<PaginatedResponse<EventEntity>> ListByUserAsync(string userId, int limit, string? cursor, CancellationToken ct = default)
    {
        var request = new QueryRequest
        {
            TableName              = _table,
            IndexName              = "GSI1",
            KeyConditionExpression = "GSI1PK = :userId AND begins_with(GSI1SK, :prefix)",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":userId"] = new() { S = $"USER#{userId}" },
                [":prefix"] = new() { S = "EVENT#" }
            },
            ScanIndexForward = false,
            Limit            = limit
        };

        if (!string.IsNullOrEmpty(cursor))
        {
            var decoded = JsonSerializer.Deserialize<Dictionary<string, string>>(
                Convert.FromBase64String(cursor));
            if (decoded is not null)
                request.ExclusiveStartKey = decoded.ToDictionary(
                    k => k.Key, v => new AttributeValue { S = v.Value });
        }

        var response = await _dynamo.QueryAsync(request, ct);

        string? nextCursor = null;
        if (response.LastEvaluatedKey?.Count > 0)
        {
            var cursorData = response.LastEvaluatedKey
                .ToDictionary(k => k.Key, v => v.Value.S);
            nextCursor = Convert.ToBase64String(
                JsonSerializer.SerializeToUtf8Bytes(cursorData));
        }

        return new PaginatedResponse<EventEntity>
        {
            Items      = response.Items.Select(Map).ToList(),
            NextCursor = nextCursor
        };
    }

    public async Task<EventEntity> CreateAsync(EventEntity entity, CancellationToken ct = default)
    {
        await _dynamo.PutItemAsync(new PutItemRequest
        {
            TableName           = _table,
            Item                = ToAttributes(entity),
            ConditionExpression = "attribute_not_exists(PK)"
        }, ct);

        _log.LogInformation("Event created: {EventId}", entity.EventId);
        return entity;
    }

    public async Task<EventEntity> UpdateAsync(EventEntity entity, CancellationToken ct = default)
    {
        entity.UpdatedAt = DateTime.UtcNow.ToString("O");

        await _dynamo.PutItemAsync(new PutItemRequest
        {
            TableName           = _table,
            Item                = ToAttributes(entity),
            ConditionExpression = "attribute_exists(PK)"
        }, ct);

        _log.LogInformation("Event updated: {EventId}", entity.EventId);
        return entity;
    }

    public async Task DeleteAsync(string eventId, CancellationToken ct = default)
    {
        await _dynamo.DeleteItemAsync(new DeleteItemRequest
        {
            TableName = _table,
            Key = new Dictionary<string, AttributeValue>
            {
                ["PK"] = new() { S = PK(eventId) },
                ["SK"] = new() { S = SK }
            }
        }, ct);

        _log.LogInformation("Event deleted: {EventId}", eventId);
    }

    private static EventEntity Map(Dictionary<string, AttributeValue> item)
        => new()
        {
            PK            = item["PK"].S,
            SK            = item["SK"].S,
            GSI1PK        = item.TryGetValue("GSI1PK", out var g1)  ? g1.S  : "",
            GSI1SK        = item.TryGetValue("GSI1SK", out var g2)  ? g2.S  : "",
            EventId       = item["eventId"].S,
            UserId        = item["userId"].S,
            Title         = item["title"].S,
            Description   = item.TryGetValue("description",   out var d)   ? d.S   : null,
            EventDate     = item["eventDate"].S,
            EndDate       = item.TryGetValue("endDate",       out var ed)  ? ed.S  : null,
            Location      = item.TryGetValue("location",      out var loc) ? loc.S : null,
            Address       = item.TryGetValue("address",       out var adr) ? adr.S : null,
            Capacity      = item.TryGetValue("capacity",      out var cap) && int.TryParse(cap.N, out var cv) ? cv : null,
            Status        = item["status"].S,
            MicrositeSlug = item.TryGetValue("micrositeSlug", out var ms)  ? ms.S  : null,
            DesignId      = item.TryGetValue("designId",      out var di)  ? di.S  : null,
            CoverImageUrl = item.TryGetValue("coverImageUrl", out var ci)  ? ci.S  : null,
            DesignJson    = item.TryGetValue("designJson",    out var dj)  ? dj.S  : null,
            Tags          = item.TryGetValue("tags",          out var tg)  ? tg.SS : new(),
            RsvpDeadline  = item.TryGetValue("rsvpDeadline",  out var rd)  ? rd.S  : null,
            CreatedAt     = item["createdAt"].S,
            UpdatedAt     = item["updatedAt"].S
        };

    private static Dictionary<string, AttributeValue> ToAttributes(EventEntity e)
    {
        var item = new Dictionary<string, AttributeValue>
        {
            ["PK"]        = new() { S = PK(e.EventId) },
            ["SK"]        = new() { S = SK },
            ["GSI1PK"]    = new() { S = $"USER#{e.UserId}" },
            ["GSI1SK"]    = new() { S = $"EVENT#{e.EventId}" },
            ["eventId"]   = new() { S = e.EventId },
            ["userId"]    = new() { S = e.UserId },
            ["title"]     = new() { S = e.Title },
            ["eventDate"] = new() { S = e.EventDate },
            ["status"]    = new() { S = e.Status },
            ["createdAt"] = new() { S = e.CreatedAt },
            ["updatedAt"] = new() { S = e.UpdatedAt }
        };

        if (e.Description   is not null) item["description"]   = new() { S = e.Description };
        if (e.EndDate        is not null) item["endDate"]       = new() { S = e.EndDate };
        if (e.Location       is not null) item["location"]      = new() { S = e.Location };
        if (e.Address        is not null) item["address"]       = new() { S = e.Address };
        if (e.Capacity       is not null) item["capacity"]      = new() { N = e.Capacity.ToString() };
        if (e.MicrositeSlug  is not null) item["micrositeSlug"] = new() { S = e.MicrositeSlug };
        if (e.DesignId       is not null) item["designId"]      = new() { S = e.DesignId };
        if (e.CoverImageUrl  is not null) item["coverImageUrl"] = new() { S = e.CoverImageUrl };
        if (e.DesignJson     is not null) item["designJson"]    = new() { S = e.DesignJson };
        if (e.Tags?.Count    > 0)         item["tags"]          = new() { SS = e.Tags };
        if (e.RsvpDeadline   is not null) item["rsvpDeadline"]  = new() { S = e.RsvpDeadline };

        return item;
    }
}
