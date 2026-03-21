using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using EventCraft.Events.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace EventCraft.Events.Repositories;

public class DynamoEventRepository : IEventRepository
{
    private readonly IAmazonDynamoDB                _dynamo;
    private readonly ILogger<DynamoEventRepository> _log;
    private readonly string                         _table;

    private static string PK(string eventId) => $"EVENT#{eventId}";
    private const  string SK = "METADATA";

    public DynamoEventRepository(IAmazonDynamoDB dynamo, ILogger<DynamoEventRepository> log, string table)
    { _dynamo = dynamo; _log = log; _table = table; }

    // ── Events ────────────────────────────────────────────────────────────────

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

    public async Task<EventEntity?> GetBySlugAsync(string slug, CancellationToken ct = default)
    {
        var response = await _dynamo.QueryAsync(new QueryRequest
        {
            TableName              = _table,
            IndexName              = "GSI2",
            KeyConditionExpression = "GSI2PK = :slug",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":slug"] = new() { S = $"SLUG#{slug}" }
            },
            Limit = 1
        }, ct);
        if (response.Items.Count == 0) return null;
        return Map(response.Items[0]);
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
            var decoded = JsonSerializer.Deserialize<Dictionary<string, string>>(Convert.FromBase64String(cursor));
            if (decoded is not null)
                request.ExclusiveStartKey = decoded.ToDictionary(k => k.Key, v => new AttributeValue { S = v.Value });
        }
        var response = await _dynamo.QueryAsync(request, ct);
        string? nextCursor = null;
        if (response.LastEvaluatedKey?.Count > 0)
        {
            var cursorData = response.LastEvaluatedKey.ToDictionary(k => k.Key, v => v.Value.S);
            nextCursor = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(cursorData));
        }
        return new PaginatedResponse<EventEntity> { Items = response.Items.Select(Map).ToList(), NextCursor = nextCursor };
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
    }

    // ── RSVPs ─────────────────────────────────────────────────────────────────

    public async Task SaveRsvpAsync(string eventId, RsvpRequest rsvp, CancellationToken ct = default)
    {
        var rsvpId = Guid.NewGuid().ToString("N");
        var item   = new Dictionary<string, AttributeValue>
        {
            ["PK"]        = new() { S = PK(eventId) },
            ["SK"]        = new() { S = $"RSVP#{rsvpId}" },
            ["rsvpId"]    = new() { S = rsvpId },
            ["eventId"]   = new() { S = eventId },
            ["name"]      = new() { S = rsvp.Name },
            ["email"]     = new() { S = rsvp.Email },
            ["response"]  = new() { S = rsvp.Response },
            ["createdAt"] = new() { S = DateTime.UtcNow.ToString("O") },
        };
        if (!string.IsNullOrEmpty(rsvp.Message))
            item["message"] = new() { S = rsvp.Message };
        await _dynamo.PutItemAsync(new PutItemRequest { TableName = _table, Item = item }, ct);
    }

    public async Task<List<RsvpEntity>> ListRsvpsAsync(string eventId, CancellationToken ct = default)
    {
        var response = await _dynamo.QueryAsync(new QueryRequest
        {
            TableName              = _table,
            KeyConditionExpression = "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":pk"]     = new() { S = PK(eventId) },
                [":prefix"] = new() { S = "RSVP#" }
            }
        }, ct);
        return response.Items.Select(item => new RsvpEntity
        {
            RsvpId    = item["rsvpId"].S,
            EventId   = eventId,
            Name      = item["name"].S,
            Email     = item["email"].S,
            Response  = item["response"].S,
            Message   = item.TryGetValue("message", out var m) ? m.S : null,
            CreatedAt = item["createdAt"].S,
        }).ToList();
    }

    // ── Contacts ──────────────────────────────────────────────────────────────

    public async Task<List<ContactEntity>> ListContactsAsync(string userId, CancellationToken ct = default)
    {
        var response = await _dynamo.QueryAsync(new QueryRequest
        {
            TableName              = _table,
            KeyConditionExpression = "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":pk"]     = new() { S = $"USER#{userId}" },
                [":prefix"] = new() { S = "CONTACT#" }
            }
        }, ct);
        return response.Items.Select(item => new ContactEntity
        {
            ContactId = item.TryGetValue("contactId", out var cid) ? cid.S : "",
            UserId    = userId,
            Name      = item.TryGetValue("name",      out var n)   ? n.S   : "",
            Email     = item.TryGetValue("email",     out var e)   ? e.S   : null,
            Phone     = item.TryGetValue("phone",     out var p)   ? p.S   : null,
            CreatedAt = item.TryGetValue("createdAt", out var ca)  ? ca.S  : "",
        }).ToList();
    }

    public async Task<ContactEntity> CreateContactAsync(string userId, CreateContactRequest req, CancellationToken ct = default)
    {
        var contactId = $"ctc_{Guid.NewGuid():N}";
        var now       = DateTime.UtcNow.ToString("O");
        var item      = new Dictionary<string, AttributeValue>
        {
            ["PK"]        = new() { S = $"USER#{userId}" },
            ["SK"]        = new() { S = $"CONTACT#{contactId}" },
            ["contactId"] = new() { S = contactId },
            ["name"]      = new() { S = req.Name },
            ["createdAt"] = new() { S = now },
        };
        if (!string.IsNullOrEmpty(req.Email)) item["email"] = new() { S = req.Email };
        if (!string.IsNullOrEmpty(req.Phone)) item["phone"] = new() { S = req.Phone };
        await _dynamo.PutItemAsync(new PutItemRequest { TableName = _table, Item = item }, ct);
        return new ContactEntity { ContactId = contactId, UserId = userId, Name = req.Name, Email = req.Email, Phone = req.Phone, CreatedAt = now };
    }

    public async Task DeleteContactAsync(string userId, string contactId, CancellationToken ct = default)
    {
        await _dynamo.DeleteItemAsync(new DeleteItemRequest
        {
            TableName = _table,
            Key = new Dictionary<string, AttributeValue>
            {
                ["PK"] = new() { S = $"USER#{userId}" },
                ["SK"] = new() { S = $"CONTACT#{contactId}" }
            }
        }, ct);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static EventEntity Map(Dictionary<string, AttributeValue> item) => new()
    {
        PK            = item["PK"].S,
        SK            = item["SK"].S,
        GSI1PK        = item.TryGetValue("GSI1PK",       out var g1)  ? g1.S  : "",
        GSI1SK        = item.TryGetValue("GSI1SK",       out var g2)  ? g2.S  : "",
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
        Schedule      = item.TryGetValue("schedule",      out var sc)  ? sc.S  : null,
        OrganizerName  = item.TryGetValue("organizerName",  out var on2) ? on2.S : null,
        OrganizerPhone = item.TryGetValue("organizerPhone", out var op)  ? op.S  : null,
        OrganizerEmail = item.TryGetValue("organizerEmail", out var oe)  ? oe.S  : null,
        GalleryUrl     = item.TryGetValue("galleryUrl",     out var gu)  ? gu.S  : null,
        CreatedAt     = item["createdAt"].S,
        UpdatedAt     = item["updatedAt"].S,
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
            ["updatedAt"] = new() { S = e.UpdatedAt },
        };
        if (e.MicrositeSlug  is not null) {
            item["micrositeSlug"] = new() { S = e.MicrositeSlug };
            item["GSI2PK"]        = new() { S = $"SLUG#{e.MicrositeSlug}" };
        }
        if (e.Description    is not null) item["description"]   = new() { S = e.Description };
        if (e.EndDate         is not null) item["endDate"]       = new() { S = e.EndDate };
        if (e.Location        is not null) item["location"]      = new() { S = e.Location };
        if (e.Address         is not null) item["address"]       = new() { S = e.Address };
        if (e.Capacity        is not null) item["capacity"]      = new() { N = e.Capacity.ToString() };
        if (e.DesignId        is not null) item["designId"]      = new() { S = e.DesignId };
        if (e.CoverImageUrl   is not null) item["coverImageUrl"] = new() { S = e.CoverImageUrl };
        if (e.DesignJson      is not null) item["designJson"]    = new() { S = e.DesignJson };
        if (e.Tags?.Count     > 0)         item["tags"]          = new() { SS = e.Tags };
        if (e.RsvpDeadline    is not null) item["rsvpDeadline"]  = new() { S = e.RsvpDeadline };
        if (e.Schedule        is not null) item["schedule"]      = new() { S = e.Schedule };
        if (e.OrganizerName   is not null) item["organizerName"] = new() { S = e.OrganizerName };
        if (e.OrganizerPhone  is not null) item["organizerPhone"]= new() { S = e.OrganizerPhone };
        if (e.OrganizerEmail  is not null) item["organizerEmail"]= new() { S = e.OrganizerEmail };
        if (e.GalleryUrl      is not null) item["galleryUrl"]    = new() { S = e.GalleryUrl };
        return item;
    }
}
