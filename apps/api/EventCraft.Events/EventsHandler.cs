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

    // â”€â”€ Health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    private static APIGatewayProxyResponse Health()
        => OkResponse(new { status = "ok", service = "eventcraft-events", timestamp = DateTime.UtcNow.ToString("O") });

    // â”€â”€ Contacts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // â”€â”€ Email invites â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            ? dt.ToString("dddd, MMMM d, yyyy \a\t h:mm tt")
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

    // â”€â”€ Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // â”€â”€ Admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // â”€â”€ Email template â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Design principle: feels like a personal invitation from the host,
    // not a product advertisement. EventCraft is mentioned only in the footer.
    // Host name is prominent. Event details are the hero.

    private static string BuildEmailHtml(
        string guestName,
        string title,
        string date,
        string location,
        string organizer,
        string organizerPhone,
        string organizerEmail,
        string rsvpUrl)
    {
        var locationRow = string.IsNullOrEmpty(location) ? "" : $@"
        <tr>
          <td width='28' valign='top' style='padding-top:2px;font-size:16px'>&#128205;</td>
          <td style='padding-bottom:12px'>
            <div style='font-size:13px;color:#d1d5db;font-family:Helvetica,Arial,sans-serif'>{location}</div>
          </td>
        </tr>";

        var contactRow = "";
        if (!string.IsNullOrEmpty(organizerPhone) || !string.IsNullOrEmpty(organizerEmail))
        {
            var contactParts = new List<string>();
            if (!string.IsNullOrEmpty(organizerPhone)) contactParts.Add(organizerPhone);
            if (!string.IsNullOrEmpty(organizerEmail)) contactParts.Add(organizerEmail);
            contactRow = $@"
        <p style='font-size:12px;color:#6b7280;margin:0 0 20px 0;font-family:Helvetica,Arial,sans-serif'>
          Questions? Reach out: {string.Join(" &middot; ", contactParts)}
        </p>";
        }

        var hostLine = string.IsNullOrEmpty(organizer) ? "" :
            $@"<p style='font-size:14px;color:#9ca3af;margin:0 0 24px 0;font-family:Helvetica,Arial,sans-serif'>
          Hosted by <span style='color:#e5e7eb;font-weight:500'>{organizer}</span>
        </p>";

        return $@"<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>{title}</title>
</head>
<body style='margin:0;padding:0;background:#111827;font-family:Georgia,serif;color:#f9fafb'>
  <div style='max-width:520px;margin:0 auto;padding:48px 28px 32px'>

    <!-- Lotus logo - subtle, centered, links to app -->
    <div style='text-align:center;margin-bottom:24px'>
      <a href='https://eventcraft.irotte.com' style='display:inline-block;text-decoration:none'>
        <svg width='36' height='36' viewBox='0 0 32 32' fill='none' xmlns='http://www.w3.org/2000/svg'>
          <g transform='translate(16,18)'>
            <ellipse cx='0' cy='-11' rx='3.5' ry='9' fill='#4F6FBF' opacity='0.85'/>
            <ellipse cx='9' cy='-6' rx='3.5' ry='8.5' fill='#4F6FBF' opacity='0.7' transform='rotate(38 9 -6)'/>
            <ellipse cx='-9' cy='-6' rx='3.5' ry='8.5' fill='#4F6FBF' opacity='0.7' transform='rotate(-38 -9 -6)'/>
            <ellipse cx='13' cy='1' rx='3' ry='7' fill='#7B9FD4' opacity='0.45' transform='rotate(65 13 1)'/>
            <ellipse cx='-13' cy='1' rx='3' ry='7' fill='#7B9FD4' opacity='0.45' transform='rotate(-65 -13 1)'/>
            <circle cx='0' cy='-5' r='4.5' fill='#0F0A2E'/>
            <circle cx='0' cy='-5' r='2.8' fill='#D4AF37'/>
            <circle cx='0' cy='-5' r='1.2' fill='#0F0A2E'/>
            <line x1='0' y1='0' x2='0' y2='9' stroke='#4F6FBF' stroke-width='1.5' stroke-linecap='round'/>
            <line x1='-6' y1='9' x2='6' y2='9' stroke='#4F6FBF' stroke-width='1' stroke-linecap='round' opacity='0.5'/>
          </g>
        </svg>
      </a>
    </div>
    <!-- Personal greeting â€” no branding here -->
    <p style='font-size:15px;color:#9ca3af;margin:0 0 8px 0;font-family:Helvetica,Arial,sans-serif'>
      Dear {guestName},
    </p>
    <p style='font-size:15px;color:#d1d5db;margin:0 0 32px 0;font-family:Helvetica,Arial,sans-serif;line-height:1.6'>
      You have been cordially invited to join us for a special occasion.
    </p>

    <!-- Event title â€” the hero -->
    <h1 style='font-size:34px;font-weight:700;color:#ffffff;margin:0 0 6px 0;line-height:1.2;font-family:Georgia,serif;letter-spacing:-0.02em'>
      {title}
    </h1>

    {hostLine}

    <!-- Thin gold divider -->
    <div style='height:1px;background:rgba(212,175,55,0.4);margin-bottom:24px'></div>

    <!-- Event details â€” clean, no card borders -->
    <table width='100%' cellpadding='0' cellspacing='0' border='0' style='margin-bottom:8px'>
      <tr>
        <td width='28' valign='top' style='padding-top:2px;font-size:16px'>&#128197;</td>
        <td style='padding-bottom:12px'>
          <div style='font-size:13px;color:#d1d5db;font-family:Helvetica,Arial,sans-serif'>{date}</div>
        </td>
      </tr>
      {locationRow}
    </table>

    {contactRow}

    <!-- RSVP button â€” warm, not corporate -->
    <div style='margin:28px 0 20px'>
      <a href='{rsvpUrl}'
         style='display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:14px 44px;border-radius:8px;font-size:15px;font-weight:600;font-family:Helvetica,Arial,sans-serif;letter-spacing:0.02em'>
        RSVP
      </a>
    </div>

    <p style='font-size:12px;color:#374151;margin:0 0 40px 0;font-family:Helvetica,Arial,sans-serif'>
      <a href='{rsvpUrl}' style='color:#6366F1'>{rsvpUrl}</a>
    </p>

    <!-- Footer â€” EventCraft credit, very subtle -->
    <div style='border-top:1px solid rgba(255,255,255,0.05);padding-top:16px'>
      <p style='font-size:11px;color:rgba(255,255,255,0.15);margin:0;font-family:Helvetica,Arial,sans-serif'>
        Sent via <span style='color:rgba(255,255,255,0.25)'>eventcraft</span> &middot; If you did not expect this, you may safely ignore it.
      </p>
    </div>

  </div>
</body>
</html>";
    }

    // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
