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
            if (method == "GET" && path == "/health") return Health();

            if (method == "GET"    && path == "/admin/users")                                         return await ListUsers(request);
            if (method == "POST"   && path.StartsWith("/admin/users/") && path.EndsWith("/enable"))   return await EnableUser(request);
            if (method == "POST"   && path.StartsWith("/admin/users/") && path.EndsWith("/disable"))  return await DisableUser(request);
            if (method == "DELETE" && path.StartsWith("/admin/users/"))                               return await DeleteUser(request);

            if (method == "GET"    && path == "/contacts")           return await ListContacts(request);
            if (method == "POST"   && path == "/contacts")           return await CreateContact(request);
            if (method == "DELETE" && path.StartsWith("/contacts/")) return await DeleteContact(request);

            // Curated image library
            if (method == "GET"    && path == "/curated")           return await ListCurated(request);
            if (method == "POST"   && path == "/curated")           return await CreateCurated(request);
            if (method == "DELETE" && path.StartsWith("/curated/")) return await DeleteCurated(request);

            if (method == "GET"  && path == "/events") return await ListEvents(request);
            if (method == "POST" && path == "/events") return await CreateEvent(request);

            if (method == "GET" && path.StartsWith("/events/slug/") && path.EndsWith("/public"))
                return await GetPublicEventBySlug(request);

            if (method == "GET"  && path.StartsWith("/events/") && path.EndsWith("/design"))       return await GetDesign(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/design"))       return await SaveDesign(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/upload-url"))   return await GetUploadUrl(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/rsvp"))         return await SubmitRsvp(request);
            if (method == "GET"  && path.StartsWith("/events/") && path.EndsWith("/rsvp"))         return await ListRsvps(request);
            if (method == "DELETE" && path.Contains("/rsvp/"))                                    return await DeleteRsvp(request);
            if (method == "GET"  && path.StartsWith("/events/") && path.EndsWith("/public"))       return await GetPublicEvent(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/invite/email")) return await SendEmailInvites(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/reminders/send")) return await SendReminders(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/duplicate"))     return await DuplicateEvent(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/messages/send")) return await SendMessage(request);
            if (method == "POST" && path.Contains("/rsvp/") && path.EndsWith("/checkin"))       return await CheckinRsvp(request);
            if (method == "GET"  && path.StartsWith("/events/") && path.EndsWith("/reminders"))      return await GetReminderLogs(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/duplicate"))        return await DuplicateEvent(request);
            if (method == "POST" && path.StartsWith("/events/") && path.EndsWith("/messages/send"))    return await SendMessage(request);
            if (method == "POST" && path.Contains("/rsvp/") && path.EndsWith("/checkin"))              return await CheckinRsvp(request);

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

    private static APIGatewayProxyResponse Health()
        => OkResponse(new { status = "ok", service = "eventcraft-events", timestamp = DateTime.UtcNow.ToString("O") });

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
            ? dt.ToString("dddd, MMMM d, yyyy \\a\\t h:mm tt")
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
                ev.Description ?? "",
                ev.OrganizerName ?? "",
                ev.OrganizerPhone ?? "",
                ev.OrganizerEmail ?? "",
                rsvpUrl);

            try
            {
                var fromName = !string.IsNullOrEmpty(ev.OrganizerName)
                    ? ev.OrganizerName
                    : "EventCraft";
                await ses.SendEmailAsync(new SendEmailRequest
                {
                    Source      = $"{fromName} <noreply@pragmaticconsulting.net>",
                    Destination = new Destination { ToAddresses = new List<string> { contact.Email! } },
                    Message     = new Message
                    {
                        Subject = new Content($"You're invited to {ev.Title}"),
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
    // Personal invitation. Text-only wordmark (SVG stripped by Gmail/Outlook).
    // Description included. eventcraft credit is subtle footer only.

    private async Task<APIGatewayProxyResponse> SendReminders(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");

        var eventId = GetSegment(req.Path, 1);
        var repo    = _services.GetRequiredService<IEventRepository>();
        var ev      = await repo.GetByIdAsync(eventId);
        if (ev is null || ev.UserId != userId) return NotFoundResponse();

        var body     = Deserialize<SendReminderRequest>(req.Body);
        var audience = body?.Audience ?? "yes";

        List<RsvpEntity> rsvps;
        if (body?.RsvpIds != null && body.RsvpIds.Count > 0)
        {
            var all = await repo.ListRsvpsAsync(eventId);
            var ids = new HashSet<string>(body.RsvpIds);
            rsvps = all.Where(r => ids.Contains(r.RsvpId)).ToList();
        }
        else
        {
            var responses = audience switch
            {
                "yes_maybe" => new[] { "yes", "maybe" },
                "all"       => new[] { "yes", "maybe", "no" },
                _           => new[] { "yes" }
            };
            rsvps = await repo.ListRsvpsByResponseAsync(eventId, responses);
        }

        var appUrl  = Environment.GetEnvironmentVariable("APP_URL") ?? "https://eventcraft.irotte.com";
        var rsvpUrl = !string.IsNullOrEmpty(ev.MicrositeSlug)
            ? $"{appUrl}/e/{ev.MicrositeSlug}"
            : $"{appUrl}/rsvp/{eventId}";

        var formattedDate = DateTime.TryParse(ev.EventDate, out var dt)
            ? dt.ToString("dddd, MMMM d, yyyy \\a\\t h:mm tt")
            : ev.EventDate;

        var ses    = new AmazonSimpleEmailServiceClient(Amazon.RegionEndpoint.USEast1);
        var sent   = new List<string>();
        var failed = new List<string>();

        foreach (var rsvp in rsvps)
        {
            if (string.IsNullOrEmpty(rsvp.Email)) continue;
            var html = BuildReminderHtml(
                rsvp.Name, ev.Title, formattedDate,
                ev.Location ?? "", FormatSchedule(ev.Schedule),
                ev.OrganizerName ?? "", ev.OrganizerPhone ?? "", ev.OrganizerEmail ?? "",
                rsvpUrl);
            try
            {
                var fromName = !string.IsNullOrEmpty(ev.OrganizerName) ? ev.OrganizerName : "EventCraft";
                await ses.SendEmailAsync(new SendEmailRequest
                {
                    Source      = $"{fromName} <noreply@pragmaticconsulting.net>",
                    Destination = new Destination { ToAddresses = new List<string> { rsvp.Email } },
                    Message     = new Message
                    {
                        Subject = new Content($"Event Reminder: {ev.Title} is coming up"),
                        Body    = new Body { Html = new Content(html) }
                    }
                });
                sent.Add(rsvp.Email);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Reminder failed for {rsvp.Email}: {ex.Message}");
                failed.Add(rsvp.Email);
            }
        }

        // Log it
        await repo.SaveReminderLogAsync(new ReminderLog
        {
            EventId     = eventId,
            TriggerType = "manual",
            Audience    = audience,
            SentCount   = sent.Count,
            FailedCount = failed.Count,
        });

        return OkResponse(ApiResponse<object>.Ok(new { sent, failed, total = rsvps.Count }));
    }

    private async Task<APIGatewayProxyResponse> GetReminderLogs(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var repo    = _services.GetRequiredService<IEventRepository>();
        var ev      = await repo.GetByIdAsync(eventId);
        if (ev is null || ev.UserId != userId) return NotFoundResponse();
        var logs = await repo.ListReminderLogsAsync(eventId);
        return OkResponse(ApiResponse<object>.Ok(logs));
    }


    private async Task<APIGatewayProxyResponse> CheckinRsvp(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");

        // Path: /events/{eventId}/rsvp/{rsvpId}/checkin
        var parts   = req.Path.Trim('/').Split('/');
        var eventId = parts.Length > 1 ? parts[1] : "";
        var rsvpId  = parts.Length > 3 ? parts[3] : "";
        if (string.IsNullOrEmpty(eventId) || string.IsNullOrEmpty(rsvpId))
            return ErrorResponse(400, "BAD_REQUEST", "Invalid path");

        var repo = _services.GetRequiredService<IEventRepository>();
        var ev   = await repo.GetByIdAsync(eventId);
        if (ev is null || ev.UserId != userId) return NotFoundResponse();

        var rsvp = await repo.CheckinRsvpAsync(eventId, rsvpId);
        if (rsvp is null) return NotFoundResponse();

        return OkResponse(ApiResponse<object>.Ok(new {
            rsvpId     = rsvp.RsvpId,
            name       = rsvp.Name,
            guestCount = rsvp.GuestCount,
            checkedIn  = rsvp.CheckedIn,
            checkedInAt = rsvp.CheckedInAt
        }));
    }

    private async Task<APIGatewayProxyResponse> DuplicateEvent(APIGatewayProxyRequest req)
    {
        var userId  = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var eventId = GetSegment(req.Path, 1);
        var repo    = _services.GetRequiredService<IEventRepository>();
        var source  = await repo.GetByIdAsync(eventId);
        if (source is null || source.UserId != userId) return NotFoundResponse();
        var newEvent = await repo.DuplicateEventAsync(eventId, userId);
        return OkResponse(ApiResponse<EventEntity>.Ok(newEvent), 201);
    }

    private async Task<APIGatewayProxyResponse> SendMessage(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");

        var eventId = GetSegment(req.Path, 1);
        var repo    = _services.GetRequiredService<IEventRepository>();
        var ev      = await repo.GetByIdAsync(eventId);
        if (ev is null || ev.UserId != userId) return NotFoundResponse();

        var body = Deserialize<SendMessageRequest>(req.Body);
        if (body is null || string.IsNullOrWhiteSpace(body.Subject) || string.IsNullOrWhiteSpace(body.Body))
            return ErrorResponse(400, "BAD_REQUEST", "Subject and body are required");

        List<RsvpEntity> rsvps;
        if (body.RsvpIds != null && body.RsvpIds.Count > 0)
        {
            var all = await repo.ListRsvpsAsync(eventId);
            var ids = new HashSet<string>(body.RsvpIds);
            rsvps = all.Where(r => ids.Contains(r.RsvpId)).ToList();
        }
        else
        {
            var responses = body.Audience switch
            {
                "yes_maybe" => new[] { "yes", "maybe" },
                "all"       => new[] { "yes", "maybe", "no" },
                _           => new[] { "yes" }
            };
            rsvps = await repo.ListRsvpsByResponseAsync(eventId, responses);
        }

        var appUrl  = Environment.GetEnvironmentVariable("APP_URL") ?? "https://eventcraft.irotte.com";
        var rsvpUrl = !string.IsNullOrEmpty(ev.MicrositeSlug)
            ? $"{appUrl}/e/{ev.MicrositeSlug}"
            : $"{appUrl}/rsvp/{eventId}";

        var ses    = new AmazonSimpleEmailServiceClient(Amazon.RegionEndpoint.USEast1);
        var sent   = new List<string>();
        var failed = new List<string>();

        foreach (var rsvp in rsvps)
        {
            if (string.IsNullOrEmpty(rsvp.Email)) continue;
            var html = BuildMessageHtml(
                rsvp.Name, ev.Title, body.Subject, body.Body,
                ev.OrganizerName ?? "",
                body.TriggerType == "followup" ? ev.GalleryUrl : null,
                rsvpUrl);
            try
            {
                var fromName = !string.IsNullOrEmpty(ev.OrganizerName) ? ev.OrganizerName : "EventCraft";
                await ses.SendEmailAsync(new SendEmailRequest
                {
                    Source      = $"{fromName} <noreply@pragmaticconsulting.net>",
                    Destination = new Destination { ToAddresses = new List<string> { rsvp.Email } },
                    Message     = new Message
                    {
                        Subject = new Content(body.Subject),
                        Body    = new Body { Html = new Content(html) }
                    }
                });
                sent.Add(rsvp.Email);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Message failed for {rsvp.Email}: {ex.Message}");
                failed.Add(rsvp.Email);
            }
        }

        await repo.SaveReminderLogAsync(new ReminderLog
        {
            EventId     = eventId,
            TriggerType = body.TriggerType,
            Audience    = body.Audience,
            SentCount   = sent.Count,
            FailedCount = failed.Count,
        });

        return OkResponse(ApiResponse<object>.Ok(new { sent, failed, total = rsvps.Count }));
    }

    private static string BuildMessageHtml(
        string guestName,
        string eventTitle,
        string subject,
        string messageBody,
        string organizer,
        string? galleryUrl,
        string eventUrl)
    {
        var hostLine = string.IsNullOrEmpty(organizer) ? "" :
            $"<p style='font-size:13px;color:#9ca3af;margin:0 0 20px 0;font-family:Helvetica,Arial,sans-serif'>From <span style='color:#e5e7eb;font-weight:500'>{organizer}</span></p>";

        var galleryBlock = string.IsNullOrEmpty(galleryUrl) ? "" : $@"
    <div style='margin:20px 0;padding:16px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);border-radius:8px;text-align:center'>
      <p style='font-size:13px;color:#D4AF37;margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-weight:600'>Event Photos</p>
      <a href='{galleryUrl}' style='display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;font-family:Helvetica,Arial,sans-serif'>View Gallery</a>
    </div>";

        var bodyFormatted = messageBody.Replace("\n", "<br>");

        return $@"<!DOCTYPE html>
<html lang='en'>
<head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{subject}</title></head>
<body style='margin:0;padding:0;background:#111827;font-family:Georgia,serif;color:#f9fafb'>
  <div style='max-width:520px;margin:0 auto;padding:40px 28px 32px'>
    <div style='text-align:center;margin-bottom:28px'>
      <a href='https://eventcraft.irotte.com' style='text-decoration:none'>
        <span style='font-size:15px;font-weight:600;color:#ffffff;font-family:Georgia,serif'>event</span><span style='font-size:15px;font-weight:600;color:#D4AF37;font-family:Georgia,serif'>craft</span>
      </a>
    </div>
    <p style='font-size:14px;color:#9ca3af;margin:0 0 6px 0;font-family:Helvetica,Arial,sans-serif'>Dear {guestName},</p>
    <h1 style='font-size:24px;font-weight:700;color:#ffffff;margin:0 0 8px 0;font-family:Georgia,serif'>{eventTitle}</h1>
    {hostLine}
    <div style='height:1px;background:rgba(212,175,55,0.4);margin-bottom:20px'></div>
    <div style='font-size:14px;color:#d1d5db;line-height:1.7;font-family:Helvetica,Arial,sans-serif;margin-bottom:20px'>{bodyFormatted}</div>
    {galleryBlock}
    <p style='font-size:12px;color:#374151;margin:0 0 32px 0;font-family:Helvetica,Arial,sans-serif'><a href='{eventUrl}' style='color:#6366F1'>{eventUrl}</a></p>
    <div style='border-top:1px solid rgba(255,255,255,0.05);padding-top:14px'>
      <p style='font-size:11px;color:rgba(255,255,255,0.15);margin:0;font-family:Helvetica,Arial,sans-serif'>Sent via <span style='color:rgba(255,255,255,0.25)'>eventcraft</span></p>
    </div>
  </div>
</body>
</html>";
    }

    private static string FormatSchedule(string? scheduleJson)
    {
        if (string.IsNullOrWhiteSpace(scheduleJson)) return "";
        try
        {
            var items = System.Text.Json.JsonSerializer.Deserialize<List<System.Text.Json.JsonElement>>(scheduleJson);
            if (items is null) return "";
            var lines = items.Select(item =>
            {
                var time = item.TryGetProperty("time", out var t) ? t.GetString() ?? "" : "";
                var desc = item.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
                return string.IsNullOrEmpty(time) ? desc : $"{time} — {desc}";
            });
            return string.Join("\n", lines);
        }
        catch { return scheduleJson ?? ""; }
    }

        private static string BuildReminderHtml(
        string guestName,
        string title,
        string date,
        string location,
        string schedule,
        string organizer,
        string organizerPhone,
        string organizerEmail,
        string rsvpUrl)
    {
        var locationRow = string.IsNullOrEmpty(location) ? "" : $@"
      <tr>
        <td width='26' valign='top' style='padding-top:2px;font-size:14px'>&#128205;</td>
        <td style='padding-bottom:10px'>
          <div style='font-size:13px;color:#d1d5db;font-family:Helvetica,Arial,sans-serif'>{location}</div>
        </td>
      </tr>";

        var scheduleBlock = "";
        if (!string.IsNullOrWhiteSpace(schedule))
        {
            scheduleBlock = $@"
    <div style='margin-bottom:20px'>
      <p style='font-size:12px;font-weight:600;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 8px 0;font-family:Helvetica,Arial,sans-serif'>Schedule</p>
      <p style='font-size:13px;color:#d1d5db;margin:0;font-family:Helvetica,Arial,sans-serif;white-space:pre-line'>{schedule}</p>
    </div>";
        }

        var contactRow = "";
        if (!string.IsNullOrEmpty(organizerPhone) || !string.IsNullOrEmpty(organizerEmail))
        {
            var pts = new List<string>();
            if (!string.IsNullOrEmpty(organizerPhone)) pts.Add(organizerPhone);
            if (!string.IsNullOrEmpty(organizerEmail)) pts.Add(organizerEmail);
            contactRow = $"<p style='font-size:12px;color:#6b7280;margin:0 0 20px 0;font-family:Helvetica,Arial,sans-serif'>Questions? {string.Join(" &middot; ", pts)}</p>";
        }

        var hostLine = string.IsNullOrEmpty(organizer) ? "" :
            $"<p style='font-size:14px;color:#9ca3af;margin:0 0 22px 0;font-family:Helvetica,Arial,sans-serif'>Hosted by <span style='color:#e5e7eb;font-weight:500'>{organizer}</span></p>";

        return $@"<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>Reminder: {title}</title>
</head>
<body style='margin:0;padding:0;background:#111827;font-family:Georgia,serif;color:#f9fafb'>
  <div style='max-width:520px;margin:0 auto;padding:40px 28px 32px'>

    <div style='text-align:center;margin-bottom:28px'>
      <a href='https://eventcraft.irotte.com' style='text-decoration:none'>
        <span style='font-size:15px;font-weight:600;color:#ffffff;font-family:Georgia,serif'>event</span><span style='font-size:15px;font-weight:600;color:#D4AF37;font-family:Georgia,serif'>craft</span>
      </a>
    </div>

    <div style='background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);border-radius:8px;padding:10px 16px;margin-bottom:24px;text-align:center'>
      <p style='font-size:12px;font-weight:600;color:#D4AF37;letter-spacing:0.1em;text-transform:uppercase;margin:0;font-family:Helvetica,Arial,sans-serif'>Event Reminder</p>
    </div>

    <p style='font-size:14px;color:#9ca3af;margin:0 0 6px 0;font-family:Helvetica,Arial,sans-serif'>Dear {guestName},</p>
    <p style='font-size:14px;color:#d1d5db;margin:0 0 28px 0;font-family:Helvetica,Arial,sans-serif;line-height:1.6'>This is a friendly reminder that the event is coming up soon. We look forward to seeing you!</p>

    <h1 style='font-size:28px;font-weight:700;color:#ffffff;margin:0 0 6px 0;line-height:1.2;font-family:Georgia,serif;letter-spacing:-0.02em'>{title}</h1>

    {hostLine}

    <div style='height:1px;background:rgba(212,175,55,0.4);margin-bottom:20px'></div>

    <table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:16px'>
      <tr>
        <td width='26' valign='top' style='padding-top:2px;font-size:14px'>&#128197;</td>
        <td style='padding-bottom:10px'>
          <div style='font-size:13px;color:#d1d5db;font-family:Helvetica,Arial,sans-serif'>{date}</div>
        </td>
      </tr>
      {locationRow}
    </table>

    {scheduleBlock}

    {contactRow}

    <div style='margin:24px 0 16px'>
      <a href='{rsvpUrl}' style='display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:13px 40px;border-radius:8px;font-size:15px;font-weight:600;font-family:Helvetica,Arial,sans-serif'>View Event &amp; Update RSVP</a>
    </div>

    <p style='font-size:12px;color:#374151;margin:0 0 32px 0;font-family:Helvetica,Arial,sans-serif'><a href='{rsvpUrl}' style='color:#6366F1'>{rsvpUrl}</a></p>

    <div style='border-top:1px solid rgba(255,255,255,0.05);padding-top:14px'>
      <p style='font-size:11px;color:rgba(255,255,255,0.15);margin:0;font-family:Helvetica,Arial,sans-serif'>Sent via <span style='color:rgba(255,255,255,0.25)'>eventcraft</span></p>
    </div>

  </div>
</body>
</html>";
    }

    private static string BuildEmailHtml(
        string guestName,
        string title,
        string date,
        string location,
        string description,
        string organizer,
        string organizerPhone,
        string organizerEmail,
        string rsvpUrl)
    {
        var locationRow = string.IsNullOrEmpty(location) ? "" : $@"
      <tr>
        <td width='26' valign='top' style='padding-top:2px;font-size:14px'>&#128205;</td>
        <td style='padding-bottom:10px'>
          <div style='font-size:13px;color:#d1d5db;font-family:Helvetica,Arial,sans-serif'>{location}</div>
        </td>
      </tr>";

        var descriptionBlock = string.IsNullOrWhiteSpace(description) ? "" :
            $"<p style='font-size:14px;color:#c9d0da;margin:0 0 20px 0;font-family:Helvetica,Arial,sans-serif;line-height:1.7'>{description}</p>";

        var contactRow = "";
        if (!string.IsNullOrEmpty(organizerPhone) || !string.IsNullOrEmpty(organizerEmail))
        {
            var pts = new List<string>();
            if (!string.IsNullOrEmpty(organizerPhone)) pts.Add(organizerPhone);
            if (!string.IsNullOrEmpty(organizerEmail)) pts.Add(organizerEmail);
            contactRow = $"<p style='font-size:12px;color:#6b7280;margin:0 0 20px 0;font-family:Helvetica,Arial,sans-serif'>Questions? Reach out: {string.Join(" &middot; ", pts)}</p>";
        }

        var hostLine = string.IsNullOrEmpty(organizer) ? "" :
            $"<p style='font-size:14px;color:#9ca3af;margin:0 0 22px 0;font-family:Helvetica,Arial,sans-serif'>Hosted by <span style='color:#e5e7eb;font-weight:500'>{organizer}</span></p>";

        return $@"<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>{title}</title>
</head>
<body style='margin:0;padding:0;background:#111827;font-family:Georgia,serif;color:#f9fafb'>
  <div style='max-width:520px;margin:0 auto;padding:40px 28px 32px'>

    <div style='text-align:center;margin-bottom:28px'>
      <a href='https://eventcraft.irotte.com' style='text-decoration:none'>
        <span style='font-size:15px;font-weight:600;color:#ffffff;font-family:Georgia,serif;letter-spacing:-0.01em'>event</span><span style='font-size:15px;font-weight:600;color:#D4AF37;font-family:Georgia,serif;letter-spacing:-0.01em'>craft</span>
      </a>
    </div>

    <p style='font-size:14px;color:#9ca3af;margin:0 0 6px 0;font-family:Helvetica,Arial,sans-serif'>Dear {guestName},</p>
    <p style='font-size:14px;color:#d1d5db;margin:0 0 28px 0;font-family:Helvetica,Arial,sans-serif;line-height:1.6'>You have been cordially invited to join us for a special occasion.</p>

    <h1 style='font-size:30px;font-weight:700;color:#ffffff;margin:0 0 6px 0;line-height:1.2;font-family:Georgia,serif;letter-spacing:-0.02em'>{title}</h1>

    {hostLine}

    <div style='height:1px;background:rgba(212,175,55,0.4);margin-bottom:20px'></div>

    <table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:16px'>
      <tr>
        <td width='26' valign='top' style='padding-top:2px;font-size:14px'>&#128197;</td>
        <td style='padding-bottom:10px'>
          <div style='font-size:13px;color:#d1d5db;font-family:Helvetica,Arial,sans-serif'>{date}</div>
        </td>
      </tr>
      {locationRow}
    </table>

    {descriptionBlock}

    {contactRow}

    <div style='margin:24px 0 16px'>
      <a href='{rsvpUrl}' style='display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:13px 40px;border-radius:8px;font-size:15px;font-weight:600;font-family:Helvetica,Arial,sans-serif;letter-spacing:0.01em'>RSVP</a>
    </div>

    <p style='font-size:12px;color:#374151;margin:0 0 32px 0;font-family:Helvetica,Arial,sans-serif'><a href='{rsvpUrl}' style='color:#6366F1'>{rsvpUrl}</a></p>

    <div style='border-top:1px solid rgba(255,255,255,0.05);padding-top:14px'>
      <p style='font-size:11px;color:rgba(255,255,255,0.15);margin:0;font-family:Helvetica,Arial,sans-serif'>Sent via <span style='color:rgba(255,255,255,0.25)'>eventcraft</span> &middot; If you did not expect this, you may safely ignore it.</p>
    </div>

  </div>
</body>
</html>";
    }

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

    // Curated image library

    private async Task<APIGatewayProxyResponse> ListCurated(APIGatewayProxyRequest req)
    {
        var repo   = _services.GetRequiredService<IEventRepository>();
        var images = await repo.ListCuratedAsync();
        return OkResponse(ApiResponse<object>.Ok(images));
    }

    private async Task<APIGatewayProxyResponse> CreateCurated(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var claims = req.RequestContext?.Authorizer?.Claims;
        var groups = claims != null && claims.ContainsKey("cognito:groups") ? claims["cognito:groups"] : "";
        if (!groups.Contains("admin")) return ErrorResponse(403, "FORBIDDEN", "Admin only");

        var body = Deserialize<CreateCuratedRequest>(req.Body);
        if (body is null || string.IsNullOrWhiteSpace(body.Title))
            return ErrorResponse(400, "BAD_REQUEST", "Title is required");

        var imageId     = Guid.NewGuid().ToString("N");
        var contentType = body.ContentType ?? "image/jpeg";
        var ext         = contentType switch {
            "image/png"  => "png",
            "image/webp" => "webp",
            "image/gif"  => "gif",
            _            => "jpg"
        };
        var s3Key     = $"curated/{imageId}.{ext}";
        var s3        = _services.GetRequiredService<IAmazonS3>();
        var uploadUrl = s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName  = _mediaBucket,
            Key         = s3Key,
            Verb        = HttpVerb.PUT,
            Expires     = DateTime.UtcNow.AddMinutes(15),
            ContentType = contentType,
        });
        var publicUrl = $"https://{_mediaBucket}.s3.amazonaws.com/{s3Key}";

        var repo   = _services.GetRequiredService<IEventRepository>();
        var entity = new CuratedImageEntity
        {
            ImageId   = imageId,
            Title     = body.Title.Trim(),
            Category  = body.Category?.Trim() ?? "General",
            S3Key     = s3Key,
            Url       = publicUrl,
            Active    = true,
            CreatedAt = DateTime.UtcNow.ToString("O"),
        };
        await repo.CreateCuratedAsync(entity);
        return OkResponse(ApiResponse<object>.Ok(new { imageId, uploadUrl, publicUrl }), 201);
    }

    private async Task<APIGatewayProxyResponse> DeleteCurated(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var claims = req.RequestContext?.Authorizer?.Claims;
        var groups = claims != null && claims.ContainsKey("cognito:groups") ? claims["cognito:groups"] : "";
        if (!groups.Contains("admin")) return ErrorResponse(403, "FORBIDDEN", "Admin only");

        var imageId = GetSegment(req.Path, 1);
        var repo    = _services.GetRequiredService<IEventRepository>();
        await repo.DeleteCuratedAsync(imageId);
        return new APIGatewayProxyResponse { StatusCode = 204, Headers = CorsHeaders() };
    }

    private async Task<APIGatewayProxyResponse> DeleteRsvp(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");

        // Path: /events/{eventId}/rsvp/{rsvpId}
        var parts   = req.Path.Split('/');
        var eventId = parts.Length > 2 ? parts[2] : "";
        var rsvpId  = parts.Length > 4 ? parts[4] : "";
        if (string.IsNullOrEmpty(eventId) || string.IsNullOrEmpty(rsvpId))
            return ErrorResponse(400, "BAD_REQUEST", "Invalid path");

        var repo = _services.GetRequiredService<IEventRepository>();
        await repo.DeleteRsvpAsync(eventId, rsvpId);
        return new APIGatewayProxyResponse { StatusCode = 204, Headers = CorsHeaders() };
    }
}