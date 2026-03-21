param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$PatchOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Profile     = "eventcraft-dev"
$Region      = "us-east-1"
$Env         = "staging"
$ProjectRoot = "D:\Projects\eventcraft"
$ApiRoot     = "$ProjectRoot\apps\api\EventCraft.Events"
$WebRoot     = "$ProjectRoot\apps\web"
$SamConfig   = "$ProjectRoot\samconfig.toml"
$ApiBase     = "https://k08tavl4m4.execute-api.$Region.amazonaws.com"
$Table       = "eventcraft-staging"

function Step([string]$msg) { Write-Host "" ; Write-Host "-- $msg" -ForegroundColor Cyan }
function Ok([string]$msg)   { Write-Host "   OK: $msg" -ForegroundColor Green }
function Fail([string]$msg) { Write-Host "   FAIL: $msg" -ForegroundColor Red; exit 1 }

# ── Write DynamoEventRepository.cs ───────────────────────────────────────────
Step "Writing source files"

Set-Content -Path "$ApiRoot\Repositories\DynamoEventRepository.cs" -Encoding UTF8 -Value @'
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
        var rsvpId = Guid.NewGuid().ToString("N");
        var item = new Dictionary<string, AttributeValue>
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
        GalleryUrl     = item.TryGetValue("galleryUrl",     out var gu)  ? gu.S  : null,
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
        if (e.GalleryUrl     is not null) item["galleryUrl"]     = new() { S = e.GalleryUrl };
        return item;
    }
}
'@
Ok "DynamoEventRepository.cs written"

Set-Content -Path "$ApiRoot\Commands\PublishEventCommand.cs" -Encoding UTF8 -Value @'
using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace EventCraft.Events.Commands;

public record PublishEventCommand(string EventId, string UserId, string MicrositeSlug) : IRequest<EventEntity?>;

public class PublishEventCommandHandler : IRequestHandler<PublishEventCommand, EventEntity?>
{
    private readonly IEventRepository                    _repo;
    private readonly ILogger<PublishEventCommandHandler> _log;

    public PublishEventCommandHandler(IEventRepository repo, ILogger<PublishEventCommandHandler> log)
    { _repo = repo; _log = log; }

    public async Task<EventEntity?> Handle(PublishEventCommand cmd, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(cmd.MicrositeSlug))
        {
            _log.LogWarning("Publish rejected - missing slug for {EventId}", cmd.EventId);
            return null;
        }

        var entity = await _repo.GetByIdAsync(cmd.EventId, ct);
        if (entity is null)
        {
            _log.LogWarning("Publish rejected - event not found: {EventId}", cmd.EventId);
            return null;
        }

        if (entity.UserId != cmd.UserId)
        {
            _log.LogWarning("Publish rejected - ownership mismatch for {EventId}", cmd.EventId);
            return null;
        }

        entity.Status        = "published";
        entity.MicrositeSlug = cmd.MicrositeSlug.ToLowerInvariant().Trim();

        return await _repo.UpdateAsync(entity, ct);
    }
}
'@
Ok "PublishEventCommand.cs written"

# ── Patch existing events missing GSI2SK ─────────────────────────────────────
Step "Patching DynamoDB — adding GSI2SK to events missing it"

$scanJson = aws dynamodb scan `
    --table-name $Table `
    --region $Region `
    --profile $Profile `
    --filter-expression "attribute_exists(GSI2PK) AND attribute_not_exists(GSI2SK) AND SK = :sk" `
    --expression-attribute-values '{\":sk\":{\"S\":\"METADATA\"}}' `
    --projection-expression "PK, eventId, GSI2PK" `
    --output json

$scanResult = $scanJson | ConvertFrom-Json
$items = $scanResult.Items

Write-Host "   Found $($items.Count) event(s) missing GSI2SK" -ForegroundColor Yellow

foreach ($item in $items) {
    $pk      = $item.PK.S
    $eventId = $item.eventId.S
    $gsi2sk  = "EVENT#$eventId"

    Write-Host "   Patching $eventId ..."

    aws dynamodb update-item `
        --table-name $Table `
        --region $Region `
        --profile $Profile `
        --key "{`"PK`":{`"S`":`"$pk`"},`"SK`":{`"S`":`"METADATA`"}}" `
        --update-expression "SET GSI2SK = :sk" `
        --expression-attribute-values "{`":sk`":{`"S`":`"$gsi2sk`"}}" `
        --output json | Out-Null

    Ok "$eventId patched"
}

if ($items.Count -eq 0) { Ok "All events already have GSI2SK - nothing to patch" }

if ($PatchOnly) {
    Write-Host ""
    Write-Host "Patch-only complete." -ForegroundColor Cyan
    exit 0
}

# ── Build + Deploy ────────────────────────────────────────────────────────────
if (-not $SkipBackend) {

    Step "dotnet build"
    Push-Location "$ProjectRoot\apps\api"
    dotnet build --configuration Release --nologo -v quiet
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "dotnet build failed" }
    Ok "Build succeeded"
    Pop-Location

    Step "SAM build"
    Push-Location $ProjectRoot
    sam build --config-env $Env --config-file $SamConfig
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "sam build failed" }
    Ok "SAM build complete"
    Pop-Location

    Step "SAM deploy"
    Push-Location $ProjectRoot
    sam deploy `
        --config-env  $Env `
        --config-file $SamConfig `
        --no-confirm-changeset `
        --no-fail-on-empty-changeset
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "sam deploy failed" }
    Ok "Lambdas deployed"
    Pop-Location

    Step "Lambda status"
    foreach ($fn in @("eventcraft-events-$Env", "eventcraft-design-$Env")) {
        $state = aws lambda get-function-configuration `
            --function-name $fn --region $Region --profile $Profile `
            --query "State" --output text 2>$null
        Ok "$fn => $state"
    }
}

if (-not $SkipFrontend) {

    Step "Frontend build + deploy"
    Push-Location $WebRoot
    npm ci --silent
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "npm ci failed" }
    npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Next.js build failed" }
    Ok "Frontend built"
    Pop-Location

    if (Get-Command "vercel" -ErrorAction SilentlyContinue) {
        Push-Location $WebRoot
        vercel deploy --prod
        if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Vercel deploy failed" }
        Ok "Frontend deployed to Vercel"
        Pop-Location
    } else {
        Write-Host "   Vercel CLI not found - push to git to trigger auto-deploy" -ForegroundColor Yellow
    }
}

# ── Smoke tests ───────────────────────────────────────────────────────────────
Step "Smoke tests"

try {
    Invoke-RestMethod -Uri "$ApiBase/health" -Method GET -UseBasicParsing | Out-Null
    Ok "Health check passed"
} catch {
    Write-Host "   WARNING: Health check failed: $_" -ForegroundColor Yellow
}

try {
    $micro = Invoke-RestMethod -Uri "$ApiBase/events/slug/test/public" -Method GET -UseBasicParsing
    if ($micro.success) { Ok "Microsite /events/slug/test/public => 200" }
    else { Write-Host "   WARNING: Microsite returned success=false" -ForegroundColor Yellow }
} catch {
    Write-Host "   WARNING: Microsite smoke test failed: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  EventCraft staging deploy complete"       -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  API:      $ApiBase"
Write-Host "  Frontend: https://eventcraft.irotte.com"
Write-Host ""
