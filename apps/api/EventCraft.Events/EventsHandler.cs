using Amazon.DynamoDBv2;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.SimpleEmail;
using Amazon.SimpleEmail.Model;
using EventCraft.Events.Commands;
using EventCraft.Events.Models;
using EventCraft.Events.Queries;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Serialization;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace EventCraft.Events;

public class EventsHandler
{
    private static readonly IServiceProvider      _services;
    private static readonly IMediator             _mediator;
    private static readonly string                _mediaBucket;

    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy        = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    static EventsHandler()
    {
        var env       = Environment.GetEnvironmentVariable("ENVIRONMENT")    ?? "staging";
        var tableName = Environment.GetEnvironmentVariable("DYNAMODB_TABLE") ?? $"eventcraft-{env}";
        var awsRegion = Environment.GetEnvironmentVariable("AWS_REGION")     ?? "us-east-1";
        _mediaBucket  = Environment.GetEnvironmentVariable("MEDIA_BUCKET")   ?? $"eventcraft-media-{env}";

        var sc = new ServiceCollection();
        sc.AddLogging(b => b.AddConsole());
        sc.AddSingleton<IAmazonDynamoDB>(_ =>
            new AmazonDynamoDBClient(Amazon.RegionEndpoint.GetBySystemName(awsRegion)));
        sc.AddSingleton<IAmazonS3>(_ =>
            new AmazonS3Client(Amazon.RegionEndpoint.GetBySystemName(awsRegion)));
        sc.AddSingleton<IEventRepository>(sp =>
            new DynamoEventRepository(
                sp.GetRequiredService<IAmazonDynamoDB>(),
                sp.GetRequiredService<ILogger<DynamoEventRepository>>(),
                tableName));
        sc.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(EventsHandler).Assembly));

        _services = sc.BuildServiceProvider();
        _mediator = _services.GetRequiredService<IMediator>();
    }

    public async Task<APIGatewayProxyResponse> FunctionHandler(
        APIGatewayProxyRequest request, ILambdaContext context)
    {
        var method = request.HttpMethod?.ToUpper() ?? "GET";
        var path   = request.Path ?? "";

        context.Logger.LogInformation($"Request: {method} {path}");

        if (method == "OPTIONS")
            return new APIGatewayProxyResponse { StatusCode = 200, Headers = CorsHeaders() };

        try
        {
            // Health
            if (method == "GET" && path == "/health") return Health();

            // Admin
            if (method == "GET"    && path == "/admin/users")                                         return await ListUsers(request);
            if (method == "POST"   && path.StartsWith("/admin/users/") && path.EndsWith("/enable"))   return await EnableUser(request);
            if (method == "POST"   && path.StartsWith("/admin/users/") && path.EndsWith("/disable"))  return await DisableUser(request);
            if (method == "DELETE" && path.StartsWith("/admin/users/"))                               return await DeleteUser(request);

            // Contacts
            if (method == "GET"    && path == "/contacts")           return await ListContacts(request);
            if (method == "POST"   && path == "/contacts")           return await CreateContact(request);
            if (method == "DELETE" && path.StartsWith("/contacts/")) return await DeleteContact(request);

            // Events
            if (method == "GET"  && path == "/events") return await ListEvents(request);
            if (method == "POST" && path == "/events") return await CreateEvent(request);

            // Slug-based public lookup (must be before /events/{id} routes)
            if (method == "GET" && path.StartsWith("/events/slug/") && path.EndsWith("/public"))
                return await GetPublicEventBySlug(request);

            // Event sub-routes
            if (method == "GET"  && path.StartsWith("/events/") && path.EndsWith("/design"))       return await GetDesign(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/design"))       return await SaveDesign(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/upload-url"))   return await GetUploadUrl(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/rsvp"))         return await SubmitRsvp(request);
            if (method == "GET"  && path.StartsWith("/events/") && path.EndsWith("/rsvp"))         return await ListRsvps(request);
            if (method == "GET"  && path.StartsWith("/events/") && path.EndsWith("/public"))       return await GetPublicEvent(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/invite/email")) return await SendEmailInvites(request);

            // Event CRUD
            if (method == "GET"    && path.StartsWith("/events/")) return await GetEvent(request);
            if (method == "PUT"    && path.StartsWith("/events/") && path.EndsWith("/publish"))    return await PublishEvent(request);
            if (method == "PUT"    && path.StartsWith("/events/")) return await UpdateEvent(request);
            if (method == "DELETE" && path.StartsWith("/events/")) return await DeleteEvent(request);

            return NotFoundResponse();
        }
        catch (Exception ex)
        {
            context.Logger.LogError($"Unhandled: {ex}");
            return ErrorResponse(500, "SERVER_ERROR", "An unexpected error occurred");
        }
    }

    // ── Health ────────────────────────────────────────────────────────────────

    private static APIGatewayProxyResponse Health()
        => OkResponse(new { status = "ok", service = "eventcraft-events", timestamp = DateTime.UtcNow.ToString("O") });

    // ── Contacts ──────────────────────────────────────────────────────────────

    private async Task<APIGatewayProxyResponse> ListContacts(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var repo     = _services.GetRequiredService<IEventRepository>();
        var contacts = await repo.ListContactsAsync(userId);
        return OkResponse(ApiResponse<object>.Ok(contacts));
    }

    private async Task<APIGatewayProxyResponse> CreateContact(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var body = Deserialize<CreateContactRequest>(req.Body);
        if (body is null || string.IsNullOrWhiteSpace(body.Name))
            return ErrorResponse(400, "BAD_REQUEST", "Name is required");
        var repo    = _services.GetRequiredService<IEventRepository>();
        var contact = await repo.CreateContactAsync(userId, body);
        return OkResponse(ApiResponse<object>.Ok(contact), 201);
    }

    private async Task<APIGatewayProxyResponse> DeleteContact(APIGatewayProxyRequest req)
    {
        var userId    = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var contactId = GetSegment(req.Path, 1);
        var repo      = _services.GetRequiredService<IEventRepository>();
        await repo.DeleteContactAsync(userId, contactId);
        return new APIGatewayProxyResponse { StatusCode = 204, Headers = CorsHeaders() };
    }

    // ── Email invites ─────────────────────────────────────────────────────────

    private async Task<APIGatewayProxyResponse> SendEmailInvites(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");

        var eventId = GetSegment(req.Path, 1);
        var body    = Deserialize<SendInviteRequest>(req.Body);
        if (body is null) return ErrorResponse(400, "BAD_REQUEST", "Invalid request body");

        var repo = _services.GetRequiredService<IEventRepository>();
        var ev   = await repo.GetByIdAsync(eventId);
        if (ev is null || ev.UserId != userId) return NotFoundResponse();

        var contacts = await repo.ListContactsAsync(userId);
        var targets  = contacts
            .Where(c => body.ContactIds.Contains(c.ContactId) && !string.IsNullOrEmpty(c.Email))
            .ToList();

        var ses    = new AmazonSimpleEmailServiceClient(Amazon.RegionEndpoint.USEast1);
        var appUrl = Environment.GetEnvironmentVariable("APP_URL") ?? "https://eventcraft.irotte.com";
        var rsvpUrl = !string.IsNullOrEmpty(ev.MicrositeSlug)
            ? $"{appUrl}/e/{ev.MicrositeSlug}"
            : $"{appUrl}/rsvp/{eventId}";

        var formattedDate = DateTime.TryParse(ev.EventDate, out var dt)
            ? dt.ToString("dddd, MMMM d, yyyy")
            : ev.EventDate;

        var sent   = new List<string>();
        var failed = new List<string>();

        foreach (var contact in targets)
        {
            var html = BuildEmailHtml(
                contact.Name,
                ev.Title,
                formattedDate,
                ev.Location ?? "",
                ev.OrganizerName ?? "",
                rsvpUrl);

            try
            {
                await ses.SendEmailAsync(new SendEmailRequest
                {
                    Source      = "noreply@pragmaticconsulting.net",
                    Destination = new Destination { ToAddresses = new List<string> { contact.Email! } },
                    Message     = new Message
                    {
                        Subject = new Content($"You're invited: {ev.Title}"),
                        Body    = new Body { Html = new Content(html) }
                    }
                });
                sent.Add(contact.Email!);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to send to {contact.Email}: {ex.Message}");
                failed.Add(contact.Email!);
            }
        }

        return OkResponse(ApiResponse<object>.Ok(new { sent, failed, total = targets.Count }));
    }

    // ── Events ────────────────────────────────────────────────────────────────

    private async Task<APIGatewayProxyResponse> CreateEvent(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var body = Deserialize<CreateEventRequest>(req.Body);
        if (body is null) return ErrorResponse(400, "BAD_REQUEST", "Invalid request body");
        if (string.IsNullOrWhiteSpace(body.Title))
            return ErrorResponse(400, "VALIDATION_ERROR", "Title is required");
        if (string.IsNullOrWhiteSpace(body.EventDate))
            return ErrorResponse(400, "VALIDATION_ERROR", "Event date is required");
        var result = await _mediator.Send(new CreateEventCommand(userId, body));
        return OkResponse(ApiResponse<EventEntity>.Ok(result), 201);
    }

    private async Task<APIGatewayProxyResponse> GetEvent(APIGatewayProxyRequest req)
    {
        var eventId = GetSegment(req.Path, 1);
        var userId  = GetUserId(req);
        var result  = await _mediator.Send(new GetEventQuery(eventId, userId));
        if (result is null) return NotFoundResponse();
        return OkResponse(ApiResponse<EventEntity>.Ok(result));
    }

    private async Task<APIGatewayProxyResponse> GetPublicEvent(APIGatewayProxyRequest req)
    {
        var eventId = GetSegment(req.Path, 1);
        var repo    = _services.GetRequiredService<IEventRepository>();
        var entity  = await repo.GetByIdAsync(eventId);
        if (entity is null) return NotFoundResponse();
        return OkResponse(ApiResponse<object>.Ok(BuildPublicPayload(entity)));
    }

    private async Task<APIGatewayProxyResponse> GetPublicEventBySlug(APIGatewayProxyRequest req)
    {
        var parts  = req.Path.Trim('/').Split('/');
        var slug   = parts.Length >= 3 ? parts[2] : "";
        var repo   = _services.GetRequiredService<IEventRepository>();
        var entity = await repo.GetBySlugAsync(slug);
        if (entity is null) return NotFoundResponse();
        return OkResponse(ApiResponse<object>.Ok(BuildPublicPayload(entity)));
    }

    private static object BuildPublicPayload(EventEntity e) => new
    {
        eventId        = e.EventId,
        title          = e.Title,
        eventDate      = e.EventDate,
        location       = e.Location,
        description    = e.Description,
        canvasJson     = e.DesignJson,
        status         = e.Status,
        micrositeSlug  = e.MicrositeSlug,
        schedule       = e.Schedule,
        organizerName  = e.OrganizerName,
        organizerPhone = e.OrganizerPhone,
        organizerEmail = e.OrganizerEmail,
        galleryUrl     = e.GalleryUrl,
    };

    private async Task<APIGatewayProxyResponse> ListEvents(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        string? limitStr = null, cursor = null;
        req.QueryStringParameters?.TryGetValue("limit",  out limitStr);
        req.QueryStringParameters?.TryGetValue("cursor", out cursor);
        int.TryParse(limitStr ?? "20", out var limit);
        if (limit <= 0) limit = 20;
        var result = await _mediator.Send(new ListEventsQuery(userId, limit, cursor));
        return OkResponse(ApiResponse<PaginatedResponse<EventEntity>>.Ok(result));
    }

    private async Task<APIGatewayProxyResponse> UpdateEvent(APIGatewayProxyRequest req)
    {
        var userId  = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var body    = Deserialize<UpdateEventRequest>(req.Body);
        if (body is null) return ErrorResponse(400, "BAD_REQUEST", "Invalid request body");
        var result  = await _mediator.Send(new UpdateEventCommand(eventId, userId, body));
        if (result is null) return NotFoundResponse();
        return OkResponse(ApiResponse<EventEntity>.Ok(result));
    }

    private async Task<APIGatewayProxyResponse> PublishEvent(APIGatewayProxyRequest req)
    {
        var userId  = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var body    = Deserialize<PublishEventRequest>(req.Body);
        if (body is null) return ErrorResponse(400, "BAD_REQUEST", "Invalid request body");
        var result  = await _mediator.Send(new PublishEventCommand(eventId, userId, body.MicrositeSlug));
        if (result is null) return NotFoundResponse();
        return OkResponse(ApiResponse<EventEntity>.Ok(result));
    }

    private async Task<APIGatewayProxyResponse> DeleteEvent(APIGatewayProxyRequest req)
    {
        var userId  = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var deleted = await _mediator.Send(new DeleteEventCommand(eventId, userId));
        if (!deleted) return NotFoundResponse();
        return new APIGatewayProxyResponse { StatusCode = 204, Headers = CorsHeaders() };
    }

    private async Task<APIGatewayProxyResponse> GetDesign(APIGatewayProxyRequest req)
    {
        var userId  = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var entity  = await _mediator.Send(new GetEventQuery(eventId, userId));
        if (entity is null) return NotFoundResponse();
        return OkResponse(ApiResponse<object>.Ok(new { canvasJson = entity.DesignJson }));
    }

    private async Task<APIGatewayProxyResponse> SaveDesign(APIGatewayProxyRequest req)
    {
        var userId  = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var body    = Deserialize<SaveDesignRequest>(req.Body);
        if (body is null) return ErrorResponse(400, "BAD_REQUEST", "Invalid request body");
        var repo    = _services.GetRequiredService<IEventRepository>();
        var entity  = await repo.GetByIdAsync(eventId);
        if (entity is null || entity.UserId != userId) return NotFoundResponse();
        entity.DesignJson = body.CanvasJson;
        await repo.UpdateAsync(entity);
        return OkResponse(ApiResponse<object>.Ok(new { saved = true }));
    }

    private async Task<APIGatewayProxyResponse> GetUploadUrl(APIGatewayProxyRequest req)
    {
        var userId  = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var body    = Deserialize<UploadUrlRequest>(req.Body);
        if (body is null) return ErrorResponse(400, "BAD_REQUEST", "Invalid request body");
        var s3     = _services.GetRequiredService<IAmazonS3>();
        var key    = $"uploads/{userId}/{eventId}/{Guid.NewGuid()}-{body.FileName}";
        var urlReq = new GetPreSignedUrlRequest
        {
            BucketName  = _mediaBucket,
            Key         = key,
            Verb        = HttpVerb.PUT,
            Expires     = DateTime.UtcNow.AddMinutes(10),
            ContentType = body.ContentType,
        };
        var presignedUrl = s3.GetPreSignedURL(urlReq);
        var publicUrl    = $"https://{_mediaBucket}.s3.amazonaws.com/{key}";
        return OkResponse(ApiResponse<object>.Ok(new { uploadUrl = presignedUrl, publicUrl }));
    }

    private async Task<APIGatewayProxyResponse> SubmitRsvp(APIGatewayProxyRequest req)
    {
        var eventId = GetSegment(req.Path, 1);
        var body    = Deserialize<RsvpRequest>(req.Body);
        if (body is null) return ErrorResponse(400, "BAD_REQUEST", "Invalid request body");
        if (string.IsNullOrWhiteSpace(body.Name) || string.IsNullOrWhiteSpace(body.Email))
            return ErrorResponse(400, "VALIDATION_ERROR", "Name and email are required");
        var repo = _services.GetRequiredService<IEventRepository>();
        await repo.SaveRsvpAsync(eventId, body);
        return OkResponse(ApiResponse<object>.Ok(new { submitted = true }));
    }

    private async Task<APIGatewayProxyResponse> ListRsvps(APIGatewayProxyRequest req)
    {
        var eventId = GetSegment(req.Path, 1);
        var repo    = _services.GetRequiredService<IEventRepository>();
        var rsvps   = await repo.ListRsvpsAsync(eventId);
        return OkResponse(ApiResponse<object>.Ok(rsvps));
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    private async Task<APIGatewayProxyResponse> ListUsers(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var claims = req.RequestContext?.Authorizer?.Claims;
        var groups = claims != null && claims.ContainsKey("cognito:groups") ? claims["cognito:groups"] : "";
        if (!groups.Contains("admin")) return ErrorResponse(403, "FORBIDDEN", "Admin only");
        var cognito    = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        var users      = new List<object>();
        string? paginationToken = null;
        do
        {
            var listReq = new Amazon.CognitoIdentityProvider.Model.ListUsersRequest
                { UserPoolId = userPoolId, Limit = 60, PaginationToken = paginationToken };
            var resp = await cognito.ListUsersAsync(listReq);
            foreach (var u in resp.Users)
            {
                var email = u.Attributes.Find(a => a.Name == "email")?.Value ?? "";
                users.Add(new { username = u.Username, email, status = u.UserStatus.Value, enabled = u.Enabled, created = u.UserCreateDate, modified = u.UserLastModifiedDate });
            }
            paginationToken = resp.PaginationToken;
        } while (paginationToken != null);
        return OkResponse(ApiResponse<object>.Ok(users));
    }

    private async Task<APIGatewayProxyResponse> EnableUser(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var username   = GetSegment(req.Path, 2);
        var cognito    = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        await cognito.AdminEnableUserAsync(new Amazon.CognitoIdentityProvider.Model.AdminEnableUserRequest { UserPoolId = userPoolId, Username = username });
        return OkResponse(ApiResponse<object>.Ok(new { success = true }));
    }

    private async Task<APIGatewayProxyResponse> DisableUser(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var username   = GetSegment(req.Path, 2);
        var cognito    = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        await cognito.AdminDisableUserAsync(new Amazon.CognitoIdentityProvider.Model.AdminDisableUserRequest { UserPoolId = userPoolId, Username = username });
        return OkResponse(ApiResponse<object>.Ok(new { success = true }));
    }

    private async Task<APIGatewayProxyResponse> DeleteUser(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var username   = GetSegment(req.Path, 2);
        var cognito    = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        await cognito.AdminDeleteUserAsync(new Amazon.CognitoIdentityProvider.Model.AdminDeleteUserRequest { UserPoolId = userPoolId, Username = username });
        return OkResponse(ApiResponse<object>.Ok(new { success = true }));
    }

    // ── Email template ────────────────────────────────────────────────────────
    // Consistent with the RSVP/microsite page (#0a0a12 dark bg, #6366F1 brand,
    // and the same tone as the WhatsApp blast: "You're invited! [title] [date] [location] RSVP here"

    private static string BuildEmailHtml(
        string name, string title, string date, string location, string organizer, string rsvpUrl)
    {
        var locationRow = string.IsNullOrEmpty(location) ? "" : $@"
        <tr>
          <td width='32' valign='top' style='font-size:18px;padding-bottom:14px'>&#128205;</td>
          <td style='padding-bottom:14px'>
            <div style='font-size:11px;color:#4b5563;text-transform:uppercase;letter-spacing:0.08em;font-family:Helvetica,Arial,sans-serif;margin-bottom:3px'>Location</div>
            <div style='font-size:15px;color:#e5e7eb;font-weight:500;font-family:Helvetica,Arial,sans-serif'>{location}</div>
          </td>
        </tr>";

        var organizerLine = string.IsNullOrEmpty(organizer) ? "" : $@"
        <p style='font-size:13px;color:#6b7280;margin:0 0 24px 0;font-family:Helvetica,Arial,sans-serif'>
          Hosted by <span style='color:#a5b4fc'>{organizer}</span>
        </p>";

        return $@"<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>You're invited: {title}</title>
</head>
<body style='margin:0;padding:0;background:#0a0a12;font-family:Georgia,serif;color:#f9fafb'>
  <div style='max-width:560px;margin:0 auto;padding:40px 24px'>

    <!-- Logo badge — inline SVG, no external images, renders everywhere -->
    <div style='text-align:center;margin-bottom:36px'>
      <div style='display:inline-block;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:20px;padding:10px 20px'>
        <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 100 100'
             style='vertical-align:middle;margin-right:8px'>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#4F46E5' transform='rotate(0 50 50)'/>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#6366F1' transform='rotate(45 50 50)'/>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#4F46E5' transform='rotate(90 50 50)'/>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#6366F1' transform='rotate(135 50 50)'/>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#4F46E5' transform='rotate(180 50 50)'/>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#6366F1' transform='rotate(225 50 50)'/>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#4F46E5' transform='rotate(270 50 50)'/>
          <ellipse cx='50' cy='50' rx='11' ry='26' fill='#6366F1' transform='rotate(315 50 50)'/>
          <circle cx='50' cy='50' r='13' fill='#D4AF37'/>
          <circle cx='50' cy='50' r='7' fill='#F5CC50'/>
        </svg>
        <span style='font-family:Georgia,serif;font-size:18px;font-weight:700;color:#ffffff;vertical-align:middle'>
          event<span style='color:#D4AF37'>craft</span>
        </span>
      </div>
    </div>

    <!-- Eyebrow -->
    <p style='text-align:center;font-size:12px;color:#6366F1;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-weight:600'>
      You are cordially invited
    </p>

    <!-- Greeting -->
    <p style='font-size:15px;color:#9ca3af;margin:0 0 12px 0;font-family:Helvetica,Arial,sans-serif'>
      Dear {name},
    </p>

    <!-- Event title -->
    <h1 style='font-size:32px;font-weight:700;color:#ffffff;margin:0 0 8px 0;line-height:1.2;font-family:Georgia,serif'>
      {title}
    </h1>

    {organizerLine}

    <!-- Gold divider -->
    <div style='height:1px;background:rgba(212,175,55,0.35);margin-bottom:24px'></div>

    <!-- Event details card -->
    <div style='background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px 24px;margin-bottom:28px'>
      <table width='100%' cellpadding='0' cellspacing='0' border='0'>
        <tr>
          <td width='32' valign='top' style='font-size:18px;padding-bottom:14px'>&#128197;</td>
          <td style='padding-bottom:14px'>
            <div style='font-size:11px;color:#4b5563;text-transform:uppercase;letter-spacing:0.08em;font-family:Helvetica,Arial,sans-serif;margin-bottom:3px'>Date</div>
            <div style='font-size:15px;color:#e5e7eb;font-weight:500;font-family:Helvetica,Arial,sans-serif'>{date}</div>
          </td>
        </tr>
        {locationRow}
      </table>
    </div>

    <!-- CTA button -->
    <div style='text-align:center;margin-bottom:16px'>
      <a href='{rsvpUrl}'
         style='display:inline-block;background:#6366F1;color:#ffffff;text-decoration:none;padding:16px 52px;border-radius:12px;font-size:16px;font-weight:700;letter-spacing:0.04em;font-family:Helvetica,Arial,sans-serif'>
        RSVP Now
      </a>
    </div>
    <p style='text-align:center;font-size:12px;color:#374151;margin:0 0 36px 0;font-family:Helvetica,Arial,sans-serif'>
      Or visit: <a href='{rsvpUrl}' style='color:#6366F1;word-break:break-all'>{rsvpUrl}</a>
    </p>

    <!-- Footer -->
    <div style='border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;text-align:center'>
      <p style='font-size:11px;color:rgba(255,255,255,0.18);margin:0 0 4px 0;font-family:Helvetica,Arial,sans-serif'>
        Powered by <span style='color:rgba(212,175,55,0.45)'>EventCraft</span> &middot; eventcraft.irotte.com
      </p>
      <p style='font-size:11px;color:rgba(255,255,255,0.1);margin:0;font-family:Helvetica,Arial,sans-serif'>
        If you did not expect this invitation, you may safely ignore this email.
      </p>
    </div>

  </div>
</body>
</html>";
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static APIGatewayProxyResponse OkResponse(object data, int statusCode = 200)
        => new() { StatusCode = statusCode, Headers = CorsHeaders(), Body = JsonSerializer.Serialize(data, _json) };

    private static APIGatewayProxyResponse ErrorResponse(int statusCode, string code, string message)
        => new() { StatusCode = statusCode, Headers = CorsHeaders(), Body = JsonSerializer.Serialize(ApiResponse<object>.Fail(message, code), _json) };

    private static APIGatewayProxyResponse NotFoundResponse()
        => ErrorResponse(404, "NOT_FOUND", "Resource not found");

    private static Dictionary<string, string> CorsHeaders() => new()
    {
        ["Content-Type"]                 = "application/json",
        ["Access-Control-Allow-Origin"]  = "*",
        ["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS",
        ["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    };

    private static string? GetUserId(APIGatewayProxyRequest req)
    {
        try
        {
            if (req.RequestContext?.Authorizer == null) return null;
            if (req.RequestContext.Authorizer.TryGetValue("claims", out var claims) &&
                claims is System.Text.Json.JsonElement el &&
                el.TryGetProperty("sub", out var sub))
                return sub.GetString();
            return null;
        }
        catch { return null; }
    }

    private static string GetSegment(string path, int index)
    {
        var parts = path.Trim('/').Split('/');
        return index < parts.Length ? parts[index] : string.Empty;
    }

    private static T? Deserialize<T>(string? body) where T : class
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try { return JsonSerializer.Deserialize<T>(body, _json); }
        catch { return null; }
    }
}
