namespace EventCraft.Events.Repositories;

using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using EventCraft.Events.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

public sealed class DynamoRsvpRepository : IRsvpRepository
{
    private readonly IAmazonDynamoDB _dynamo;
    private readonly ILogger<DynamoRsvpRepository> _log;
    private readonly string _tableName;

    private static string RsvpPK(string eventId)   => $"EVENT#{eventId}";
    private static string RsvpSK(string email)      => $"RSVP#{email}";
    private static string StatusGsi1Pk(string status) => $"RSVP#{status}";

    public DynamoRsvpRepository(
        IAmazonDynamoDB dynamo,
        ILogger<DynamoRsvpRepository> log,
        string tableName)
    {
        _dynamo    = dynamo;
        _log       = log;
        _tableName = tableName;
    }

    public async Task<Result<RsvpEntity>> GetAsync(string eventId, string guestEmail, CancellationToken ct = default)
    {
        try
        {
            var response = await _dynamo.GetItemAsync(new GetItemRequest
            {
                TableName = _tableName,
                Key = new Dictionary<string, AttributeValue>
                {
                    ["PK"] = new() { S = RsvpPK(eventId) },
                    ["SK"] = new() { S = RsvpSK(guestEmail) }
                }
            }, ct);

            if (!response.IsItemSet)
                return Result<RsvpEntity>.NotFound("RSVP not found");

            return Result<RsvpEntity>.Ok(MapToEntity(response.Item));
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "GetAsync failed for eventId={EventId} email={Email}", eventId, guestEmail);
            return Result<RsvpEntity>.ServerError();
        }
    }

    public async Task<Result<RsvpEntity>> UpsertAsync(RsvpEntity entity, CancellationToken ct = default)
    {
        try
        {
            var item = MapToAttributes(entity);
            await _dynamo.PutItemAsync(new PutItemRequest
            {
                TableName = _tableName,
                Item      = item
            }, ct);

            _log.LogInformation("RSVP upserted: {EventId}/{Email} status={Status}",
                entity.EventId, entity.GuestEmail, entity.Status);
            return Result<RsvpEntity>.Ok(entity);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "UpsertAsync failed for eventId={EventId}", entity.EventId);
            return Result<RsvpEntity>.ServerError();
        }
    }

    public async Task<Result<PaginatedResult<RsvpEntity>>> ListByEventAsync(
        string eventId, int limit, string? cursor, CancellationToken ct = default)
    {
        try
        {
            var request = new QueryRequest
            {
                TableName              = _tableName,
                KeyConditionExpression = "PK = :pk AND begins_with(SK, :prefix)",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":pk"]     = new() { S = RsvpPK(eventId) },
                    [":prefix"] = new() { S = "RSVP#" }
                },
                Limit = limit
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
                    .ToDictionary(kvp => kvp.Key, kvp => kvp.Value.S);
                nextCursor = Convert.ToBase64String(
                    JsonSerializer.SerializeToUtf8Bytes(cursorData));
            }

            return Result<PaginatedResult<RsvpEntity>>.Ok(new PaginatedResult<RsvpEntity>
            {
                Items      = response.Items.Select(MapToEntity).ToList(),
                NextCursor = nextCursor
            });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "ListByEventAsync failed for eventId={EventId}", eventId);
            return Result<PaginatedResult<RsvpEntity>>.ServerError();
        }
    }

    public async Task<Result<RsvpSummary>> GetSummaryAsync(string eventId, CancellationToken ct = default)
    {
        try
        {
            // Scan all RSVPs for this event and aggregate
            var response = await _dynamo.QueryAsync(new QueryRequest
            {
                TableName              = _tableName,
                KeyConditionExpression = "PK = :pk AND begins_with(SK, :prefix)",
                ExpressionAttributeValues = new Dictionary<string, AttributeValue>
                {
                    [":pk"]     = new() { S = RsvpPK(eventId) },
                    [":prefix"] = new() { S = "RSVP#" }
                },
                ProjectionExpression = "#s, plusOnes",
                ExpressionAttributeNames = new Dictionary<string, string>
                {
                    ["#s"] = "status"
                }
            }, ct);

            var summary = new RsvpSummary();
            foreach (var item in response.Items)
            {
                summary.Total++;
                var status   = item.TryGetValue("status", out var s) ? s.S : "pending";
                var plusOnes = item.TryGetValue("plusOnes", out var p) && int.TryParse(p.N, out var pv) ? pv : 0;

                switch (status)
                {
                    case "yes":
                        summary.Yes++;
                        summary.TotalAttending += 1 + plusOnes;
                        break;
                    case "no":     summary.No++;      break;
                    case "maybe":  summary.Maybe++;   break;
                    default:       summary.Pending++; break;
                }
            }

            return Result<RsvpSummary>.Ok(summary);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "GetSummaryAsync failed for eventId={EventId}", eventId);
            return Result<RsvpSummary>.ServerError();
        }
    }

    private static RsvpEntity MapToEntity(Dictionary<string, AttributeValue> item)
        => new()
        {
            PK           = item["PK"].S,
            SK           = item["SK"].S,
            GSI1PK       = item.TryGetValue("GSI1PK", out var g1pk) ? g1pk.S : "",
            GSI1SK       = item.TryGetValue("GSI1SK", out var g1sk) ? g1sk.S : "",
            EventId      = item["eventId"].S,
            GuestEmail   = item["guestEmail"].S,
            GuestName    = item["guestName"].S,
            Status       = item["status"].S,
            PlusOnes     = item.TryGetValue("plusOnes", out var p) && int.TryParse(p.N, out var pv) ? pv : 0,
            Message      = item.TryGetValue("message", out var msg) ? msg.S : null,
            RespondedAt  = item.TryGetValue("respondedAt", out var ra) ? ra.S : null,
            CreatedAt    = item["createdAt"].S,
            UpdatedAt    = item["updatedAt"].S
        };

    private static Dictionary<string, AttributeValue> MapToAttributes(RsvpEntity r)
    {
        var item = new Dictionary<string, AttributeValue>
        {
            ["PK"]         = new() { S = RsvpPK(r.EventId) },
            ["SK"]         = new() { S = RsvpSK(r.GuestEmail) },
            ["GSI1PK"]     = new() { S = StatusGsi1Pk(r.Status) },
            ["GSI1SK"]     = new() { S = $"EVENT#{r.EventId}" },
            ["eventId"]    = new() { S = r.EventId },
            ["guestEmail"] = new() { S = r.GuestEmail },
            ["guestName"]  = new() { S = r.GuestName },
            ["status"]     = new() { S = r.Status },
            ["plusOnes"]   = new() { N = r.PlusOnes.ToString() },
            ["createdAt"]  = new() { S = r.CreatedAt },
            ["updatedAt"]  = new() { S = r.UpdatedAt }
        };

        if (r.Message     is not null) item["message"]     = new() { S = r.Message };
        if (r.RespondedAt is not null) item["respondedAt"] = new() { S = r.RespondedAt };

        return item;
    }
}
