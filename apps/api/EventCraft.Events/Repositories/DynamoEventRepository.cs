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
        var normalized = slug.ToLowerInvariant().Trim();
        var response = await _dynamo.QueryAsync(new QueryRequest
        {
            TableName              = _table,
            IndexName              = "GSI2",
            KeyConditionExpression = "GSI2PK = :slug",
            FilterExpression       = "#st = :published",
            ExpressionAttributeNames = new Dictionary<string, string>
            {
                ["#st"] = "status"
            },
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":slug"]      = new() { S = $"SLUG#{normalized}" },
                [":published"] = new() { S = "published" }
            },
            Limit = 1
        }, ct);
        if (response.Items.Count == 0) return null;
        return Map(response.Items[0]);
    }

    public async Task<PaginatedResponse<EventEntity>> ListByUserAsync(
        string userId, int limit, string? cursor, CancellationToken ct = default)
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
            var cursorData = response.LastEvaluatedKey.ToDictionary(k => k.Key, v => v.Value.S);
            nextCursor = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(cursorData));
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
    }

    public async Task SaveRsvpAsync(string eventId, RsvpRequest rsvp, CancellationToken ct = default)
    {
        // Check for existing RSVP with same email for this event (upsert)
        var existing = await _dynamo.QueryAsync(new QueryRequest
        {
            TableName              = _table,
            KeyConditionExpression = "PK = :pk AND begins_with(SK, :prefix)",
            FilterExpression       = "email = :email",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":pk"]     = new() { S = PK(eventId) },
                [":prefix"] = new() { S = "RSVP#" },
                [":email"]  = new() { S = rsvp.Email },
            }
        }, ct);

        var rsvpId    = existing.Items.Count > 0
            ? existing.Items[0]["rsvpId"].S
            : Guid.NewGuid().ToString("N");
        var createdAt = existing.Items.Count > 0
            ? existing.Items[0]["createdAt"].S
            : DateTime.UtcNow.ToString("O");

        var item = new Dictionary<string, AttributeValue>
        {
            ["PK"]        = new() { S = PK(eventId) },
            ["SK"]        = new() { S = $"RSVP#{rsvpId}" },
            ["rsvpId"]    = new() { S = rsvpId },
            ["eventId"]   = new() { S = eventId },
            ["name"]      = new() { S = rsvp.Name },
            ["email"]     = new() { S = rsvp.Email },
            ["response"]  = new() { S = rsvp.Response },
            ["createdAt"] = new() { S = createdAt },
            ["updatedAt"] = new() { S = DateTime.UtcNow.ToString("O") },
            ["guestCount"] = new() { N = Math.Max(1, rsvp.GuestCount).ToString() },
        };
        if (!string.IsNullOrEmpty(rsvp.Message))
            item["message"] = new() { S = rsvp.Message };
        else
            item["message"] = new() { S = "" };

        await _dynamo.PutItemAsync(new PutItemRequest { TableName = _table, Item = item }, ct);
        _log.LogInformation("RSVP upserted: {RsvpId} for event {EventId} email {Email}", rsvpId, eventId, rsvp.Email);
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
            RsvpId     = item["rsvpId"].S,
                GuestCount = item.TryGetValue("guestCount", out var gc) ? int.Parse(gc.N ?? "1") : 1,
            EventId   = eventId,
            Name      = item["name"].S,
            Email     = item["email"].S,
            Response  = item["response"].S,
            Message   = item.TryGetValue("message", out var m) ? m.S : null,
            CreatedAt  = item["createdAt"].S,
            CheckedIn  = item.TryGetValue("checkedIn",  out var ci) && ci.BOOL,
            CheckedInAt = item.TryGetValue("checkedInAt", out var cia) ? cia.S : null,
        }).ToList();
    }

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

    public async Task<ContactEntity> CreateContactAsync(
        string userId, CreateContactRequest req, CancellationToken ct = default)
    {
        var contactId = $"ctc_{Guid.NewGuid():N}";
        var now       = DateTime.UtcNow.ToString("O");
        var item = new Dictionary<string, AttributeValue>
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
        return new ContactEntity
        {
            ContactId = contactId, UserId = userId, Name = req.Name,
            Email = req.Email, Phone = req.Phone, CreatedAt = now
        };
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

    private static EventEntity Map(Dictionary<string, AttributeValue> item) => new()
    {
        PK             = item["PK"].S,
        SK             = item["SK"].S,
        GSI1PK         = item.TryGetValue("GSI1PK",        out var g1)  ? g1.S  : "",
        GSI1SK         = item.TryGetValue("GSI1SK",        out var g2)  ? g2.S  : "",
        EventId        = item["eventId"].S,
        UserId         = item["userId"].S,
        Title          = item["title"].S,
        Description    = item.TryGetValue("description",   out var d)   ? d.S   : null,
        EventDate      = item["eventDate"].S,
        EndDate        = item.TryGetValue("endDate",        out var ed)  ? ed.S  : null,
        Location       = item.TryGetValue("location",       out var loc) ? loc.S : null,
        Address        = item.TryGetValue("address",        out var adr) ? adr.S : null,
        Capacity       = item.TryGetValue("capacity",       out var cap) && int.TryParse(cap.N, out var cv) ? cv : null,
        Status         = item.TryGetValue("status",         out var st)  ? st.S  : "draft",
        MicrositeSlug  = item.TryGetValue("micrositeSlug",  out var ms)  ? ms.S  : null,
        DesignId       = item.TryGetValue("designId",       out var di)  ? di.S  : null,
        CoverImageUrl  = item.TryGetValue("coverImageUrl",  out var ci)  ? ci.S  : null,
        DesignJson     = item.TryGetValue("designJson",     out var dj)  ? dj.S  : null,
        Tags           = item.TryGetValue("tags",           out var tg)  ? tg.SS : new(),
        RsvpDeadline   = item.TryGetValue("rsvpDeadline",   out var rd)  ? rd.S  : null,
        Schedule       = item.TryGetValue("schedule",       out var sc)  ? sc.S  : null,
        OrganizerName  = item.TryGetValue("organizerName",  out var on2) ? on2.S : null,
        OrganizerPhone = item.TryGetValue("organizerPhone", out var op)  ? op.S  : null,
        OrganizerEmail = item.TryGetValue("organizerEmail", out var oe)  ? oe.S  : null,
        GalleryUrl        = item.TryGetValue("galleryUrl",        out var gu)  ? gu.S  : null,
        ReminderSchedule  = item.TryGetValue("reminderSchedule",  out var rs)  ? rs.S  : null,
        CreatedAt      = item["createdAt"].S,
        UpdatedAt      = item.TryGetValue("updatedAt",      out var ua)  ? ua.S  : "",
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
        if (e.MicrositeSlug is not null)
        {
            item["micrositeSlug"] = new() { S = e.MicrositeSlug };
            item["GSI2PK"]        = new() { S = $"SLUG#{e.MicrositeSlug}" };
            item["GSI2SK"]        = new() { S = $"EVENT#{e.EventId}" };
        }
        if (e.Description    is not null) item["description"]    = new() { S = e.Description };
        if (e.EndDate        is not null) item["endDate"]        = new() { S = e.EndDate };
        if (e.Location       is not null) item["location"]       = new() { S = e.Location };
        if (e.Address        is not null) item["address"]        = new() { S = e.Address };
        if (e.Capacity       is not null) item["capacity"]       = new() { N = e.Capacity.ToString() };
        if (e.DesignId       is not null) item["designId"]       = new() { S = e.DesignId };
        if (e.CoverImageUrl  is not null) item["coverImageUrl"]  = new() { S = e.CoverImageUrl };
        if (e.DesignJson     is not null) item["designJson"]     = new() { S = e.DesignJson };
        if (e.Tags?.Count    > 0)         item["tags"]           = new() { SS = e.Tags };
        if (e.RsvpDeadline   is not null) item["rsvpDeadline"]   = new() { S = e.RsvpDeadline };
        if (e.Schedule       is not null) item["schedule"]       = new() { S = e.Schedule };
        if (e.OrganizerName  is not null) item["organizerName"]  = new() { S = e.OrganizerName };
        if (e.OrganizerPhone is not null) item["organizerPhone"] = new() { S = e.OrganizerPhone };
        if (e.OrganizerEmail is not null) item["organizerEmail"] = new() { S = e.OrganizerEmail };
        if (e.GalleryUrl       is not null) item["galleryUrl"]       = new() { S = e.GalleryUrl };
        if (e.ReminderSchedule is not null) item["reminderSchedule"] = new() { S = e.ReminderSchedule };
        return item;
    }

    // Curated image library
    public async Task<List<CuratedImageEntity>> ListCuratedAsync(CancellationToken ct = default)
    {
        var response = await _dynamo.ScanAsync(new ScanRequest
        {
            TableName        = _table,
            FilterExpression = "begins_with(PK, :prefix) AND SK = :sk AND #active = :true",
            ExpressionAttributeNames = new Dictionary<string, string> { ["#active"] = "active" },
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":prefix"] = new() { S = "CURATED#" },
                [":sk"]     = new() { S = "METADATA" },
                [":true"]   = new() { BOOL = true },
            }
        }, ct);
        return response.Items.Select(MapCurated).ToList();
    }

    public async Task<CuratedImageEntity> CreateCuratedAsync(CuratedImageEntity entity, CancellationToken ct = default)
    {
        var item = new Dictionary<string, AttributeValue>
        {
            ["PK"]        = new() { S = $"CURATED#{entity.ImageId}" },
            ["SK"]        = new() { S = "METADATA" },
            ["imageId"]   = new() { S = entity.ImageId },
            ["title"]     = new() { S = entity.Title },
            ["category"]  = new() { S = entity.Category },
            ["s3Key"]     = new() { S = entity.S3Key },
            ["url"]       = new() { S = entity.Url },
            ["active"]    = new() { BOOL = entity.Active },
            ["createdAt"] = new() { S = entity.CreatedAt },
        };
        await _dynamo.PutItemAsync(new PutItemRequest { TableName = _table, Item = item }, ct);
        _log.LogInformation("Curated image created: {ImageId}", entity.ImageId);
        return entity;
    }

    public async Task DeleteCuratedAsync(string imageId, CancellationToken ct = default)
    {
        await _dynamo.DeleteItemAsync(new DeleteItemRequest
        {
            TableName = _table,
            Key = new Dictionary<string, AttributeValue>
            {
                ["PK"] = new() { S = $"CURATED#{imageId}" },
                ["SK"] = new() { S = "METADATA" }
            }
        }, ct);
        _log.LogInformation("Curated image deleted: {ImageId}", imageId);
    }

    private static CuratedImageEntity MapCurated(Dictionary<string, AttributeValue> item) => new()
    {
        ImageId   = item.TryGetValue("imageId",   out var id)  ? id.S   : "",
        Title     = item.TryGetValue("title",     out var t)   ? t.S    : "",
        Category  = item.TryGetValue("category",  out var cat) ? cat.S  : "General",
        S3Key     = item.TryGetValue("s3Key",     out var sk)  ? sk.S   : "",
        Url       = item.TryGetValue("url",       out var u)   ? u.S    : "",
        Active    = item.TryGetValue("active",    out var a)   && a.BOOL,
        CreatedAt = item.TryGetValue("createdAt", out var ca)  ? ca.S   : "",
    };

    public async Task<List<RsvpEntity>> ListRsvpsByResponseAsync(
        string eventId, IEnumerable<string> responses, CancellationToken ct = default)
    {
        var all = await ListRsvpsAsync(eventId, ct);
        var set = new HashSet<string>(responses, StringComparer.OrdinalIgnoreCase);
        return all.Where(r => set.Contains(r.Response)).ToList();
    }

    public async Task DeleteRsvpAsync(string eventId, string rsvpId, CancellationToken ct = default)
    {
        await _dynamo.DeleteItemAsync(new DeleteItemRequest
        {
            TableName = _table,
            Key = new Dictionary<string, AttributeValue>
            {
                ["PK"] = new() { S = $"EVENT#{eventId}" },
                ["SK"] = new() { S = $"RSVP#{rsvpId}" }
            }
        }, ct);
        _log.LogInformation("RSVP deleted: {RsvpId} from event {EventId}", rsvpId, eventId);
    }
    public async Task<ReminderLog> SaveReminderLogAsync(ReminderLog log, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow.ToString("O");
        log.ReminderLogId = log.ReminderLogId ?? Guid.NewGuid().ToString("N");
        log.SentAt        = now;
        var item = new Dictionary<string, AttributeValue>
        {
            ["PK"]            = new() { S = $"EVENT#{log.EventId}" },
            ["SK"]            = new() { S = $"REMINDERLOG#{log.ReminderLogId}" },
            ["reminderLogId"] = new() { S = log.ReminderLogId },
            ["eventId"]       = new() { S = log.EventId },
            ["triggerType"]   = new() { S = log.TriggerType },
            ["audience"]      = new() { S = log.Audience },
            ["sentCount"]     = new() { N = log.SentCount.ToString() },
            ["failedCount"]   = new() { N = log.FailedCount.ToString() },
            ["sentAt"]        = new() { S = log.SentAt },
        };
        if (log.DaysBefore.HasValue)
            item["daysBefore"] = new() { N = log.DaysBefore.Value.ToString() };
        await _dynamo.PutItemAsync(new PutItemRequest { TableName = _table, Item = item }, ct);
        _log.LogInformation("ReminderLog saved: {LogId} for event {EventId}", log.ReminderLogId, log.EventId);
        return log;
    }

    public async Task<List<ReminderLog>> ListReminderLogsAsync(string eventId, CancellationToken ct = default)
    {
        var response = await _dynamo.QueryAsync(new QueryRequest
        {
            TableName              = _table,
            KeyConditionExpression = "PK = :pk AND begins_with(SK, :prefix)",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":pk"]     = new() { S = $"EVENT#{eventId}" },
                [":prefix"] = new() { S = "REMINDERLOG#" }
            },
            ScanIndexForward = false
        }, ct);
        return response.Items.Select(item => new ReminderLog
        {
            ReminderLogId = item.TryGetValue("reminderLogId", out var lid) ? lid.S : "",
            EventId       = eventId,
            TriggerType   = item.TryGetValue("triggerType",   out var tt)  ? tt.S  : "",
            Audience      = item.TryGetValue("audience",      out var au)  ? au.S  : "",
            SentCount     = item.TryGetValue("sentCount",     out var sc)  && int.TryParse(sc.N, out var sv) ? sv : 0,
            FailedCount   = item.TryGetValue("failedCount",   out var fc)  && int.TryParse(fc.N, out var fv) ? fv : 0,
            SentAt        = item.TryGetValue("sentAt",        out var sa)  ? sa.S  : "",
            DaysBefore    = item.TryGetValue("daysBefore",    out var db)  && int.TryParse(db.N, out var dv) ? dv : null,
        }).ToList();
    }

    public async Task<EventEntity> DuplicateEventAsync(string eventId, string newUserId, CancellationToken ct = default)
    {
        var source = await GetByIdAsync(eventId, ct);
        if (source is null) throw new Exception($"Event {eventId} not found");
        var now = DateTime.UtcNow.ToString("O");
        var newEntity = new EventEntity
        {
            EventId          = $"evt_{Guid.NewGuid():N}",
            UserId           = newUserId,
            Title            = $"{source.Title} (Copy)",
            Description      = source.Description,
            EventDate        = now, // host must set new date
            Location         = source.Location,
            Address          = source.Address,
            Capacity         = source.Capacity,
            Status           = "draft",
            Tags             = source.Tags ?? new(),
            Schedule         = source.Schedule,
            OrganizerName    = source.OrganizerName,
            OrganizerPhone   = source.OrganizerPhone,
            OrganizerEmail   = source.OrganizerEmail,
            ReminderSchedule = source.ReminderSchedule,
            CreatedAt        = now,
            UpdatedAt        = now,
        };
        return await CreateAsync(newEntity, ct);
    }

    public async Task<RsvpEntity?> CheckinRsvpAsync(string eventId, string rsvpId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow.ToString("O");
        var key = new Dictionary<string, AttributeValue>
        {
            ["PK"] = new() { S = $"EVENT#{eventId}" },
            ["SK"] = new() { S = $"RSVP#{rsvpId}" }
        };
        var exprVals = new Dictionary<string, AttributeValue>
        {
            [":true"] = new() { BOOL = true },
            [":now"]  = new() { S = now }
        };
        await _dynamo.UpdateItemAsync(new UpdateItemRequest
        {
            TableName                 = _table,
            Key                       = key,
            UpdateExpression          = "SET checkedIn = :true, checkedInAt = :now",
            ExpressionAttributeValues = exprVals,
            ConditionExpression       = "attribute_exists(PK)"
        }, ct);
        // Return updated entity
        var getResp = await _dynamo.GetItemAsync(new GetItemRequest { TableName = _table, Key = key }, ct);
        if (!getResp.IsItemSet) return null;
        var item = getResp.Item;
        return new RsvpEntity
        {
            RsvpId     = item["rsvpId"].S,
            EventId    = eventId,
            Name       = item["name"].S,
            Email      = item["email"].S,
            Response   = item["response"].S,
            Message    = item.TryGetValue("message",    out var m)  ? m.S  : null,
            CreatedAt  = item["createdAt"].S,
            GuestCount = item.TryGetValue("guestCount", out var gc) ? int.Parse(gc.N ?? "1") : 1,
            CheckedIn  = true,
            CheckedInAt = now,
        };
    }

}