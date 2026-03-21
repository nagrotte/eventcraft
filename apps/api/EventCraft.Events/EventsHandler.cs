using Amazon.DynamoDBv2;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using Amazon.S3;
using Amazon.S3.Model;
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
    private static readonly IServiceProvider _services;
    private static readonly IMediator        _mediator;
    private static readonly string           _mediaBucket;

    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy        = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    static EventsHandler()
    {
        var env        = Environment.GetEnvironmentVariable("ENVIRONMENT")    ?? "staging";
        var tableName  = Environment.GetEnvironmentVariable("DYNAMODB_TABLE") ?? $"eventcraft-{env}";
        var awsRegion  = Environment.GetEnvironmentVariable("AWS_REGION")     ?? "us-east-1";
        _mediaBucket   = Environment.GetEnvironmentVariable("MEDIA_BUCKET")   ?? $"eventcraft-media-{env}";

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
            if (method == "GET"    && path == "/health")               return Health();
            if (method == "GET"    && path == "/admin/users")          return await ListUsers(request);
            if (method == "POST"   && path.StartsWith("/admin/users/") && path.EndsWith("/enable"))  return await EnableUser(request);
            if (method == "POST"   && path.StartsWith("/admin/users/") && path.EndsWith("/disable")) return await DisableUser(request);
            if (method == "DELETE" && path.StartsWith("/admin/users/"))                              return await DeleteUser(request);
            if (method == "GET"    && path == "/events")               return await ListEvents(request);
            if (method == "POST"   && path == "/events")               return await CreateEvent(request);

            if (method == "GET"    && path.StartsWith("/events/") && path.EndsWith("/design"))
                return await GetDesign(request);
            if (method == "POST"   && path.StartsWith("/events/") && path.EndsWith("/design"))
                return await SaveDesign(request);
            if (method == "POST"   && path.StartsWith("/events/") && path.EndsWith("/upload-url"))
                return await GetUploadUrl(request);
            if (method == "POST"   && path.StartsWith("/events/") && path.EndsWith("/rsvp"))
                return await SubmitRsvp(request);
            if (method == "GET"    && path.StartsWith("/events/") && path.EndsWith("/rsvp"))
                return await ListRsvps(request);
            if (method == "GET"    && path.StartsWith("/events/") && path.EndsWith("/public"))
                return await GetPublicEvent(request);
            if (method == "GET"    && path.StartsWith("/events/"))     return await GetEvent(request);
            if (method == "PUT"    && path.StartsWith("/events/") && path.EndsWith("/publish"))
                return await PublishEvent(request);
            if (method == "PUT"    && path.StartsWith("/events/"))     return await UpdateEvent(request);
            if (method == "DELETE" && path.StartsWith("/events/"))     return await DeleteEvent(request);

            return NotFoundResponse();
        }
        catch (Exception ex)
        {
            context.Logger.LogError($"Unhandled: {ex}");
            return ErrorResponse(500, "SERVER_ERROR", "An unexpected error occurred");
        }
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    private static APIGatewayProxyResponse Health()
        => OkResponse(new { status = "ok", service = "eventcraft-events", timestamp = DateTime.UtcNow.ToString("O") });

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
        return OkResponse(ApiResponse<object>.Ok(new {
            eventId     = entity.EventId,
            title       = entity.Title,
            eventDate   = entity.EventDate,
            location    = entity.Location,
            description = entity.Description,
            canvasJson  = entity.DesignJson,
            status      = entity.Status,
        }));
    }

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

    // ── Admin handlers ────────────────────────────────────────────────────────

    private async Task<APIGatewayProxyResponse> ListUsers(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var claims = req.RequestContext?.Authorizer?.Claims;
        var groups = claims != null && claims.ContainsKey("cognito:groups") ? claims["cognito:groups"] : "";
        if (!groups.Contains("admin")) return ErrorResponse(403, "FORBIDDEN", "Admin only");
        var cognito = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = System.Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        var users = new System.Collections.Generic.List<object>();
        string? paginationToken = null;
        do {
            var listReq = new Amazon.CognitoIdentityProvider.Model.ListUsersRequest
            {
                UserPoolId = userPoolId,
                Limit = 60,
                PaginationToken = paginationToken
            };
            var resp = await cognito.ListUsersAsync(listReq);
            foreach (var u in resp.Users) {
                var email = u.Attributes.Find(a => a.Name == "email")?.Value ?? "";
                users.Add(new {
                    username = u.Username,
                    email,
                    status   = u.UserStatus.Value,
                    enabled  = u.Enabled,
                    created  = u.UserCreateDate,
                    modified = u.UserLastModifiedDate
                });
            }
            paginationToken = resp.PaginationToken;
        } while (paginationToken != null);
        return OkResponse(ApiResponse<object>.Ok(users));
    }

    private async Task<APIGatewayProxyResponse> EnableUser(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var username = GetSegment(req.Path, 2);
        var cognito = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = System.Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        await cognito.AdminEnableUserAsync(new Amazon.CognitoIdentityProvider.Model.AdminEnableUserRequest
        {
            UserPoolId = userPoolId,
            Username = username
        });
        return OkResponse(ApiResponse<object>.Ok(new { success = true }));
    }

    private async Task<APIGatewayProxyResponse> DisableUser(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var username = GetSegment(req.Path, 2);
        var cognito = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = System.Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        await cognito.AdminDisableUserAsync(new Amazon.CognitoIdentityProvider.Model.AdminDisableUserRequest
        {
            UserPoolId = userPoolId,
            Username = username
        });
        return OkResponse(ApiResponse<object>.Ok(new { success = true }));
    }

    private async Task<APIGatewayProxyResponse> DeleteUser(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return ErrorResponse(401, "UNAUTHORIZED", "Unauthorized");
        var username = GetSegment(req.Path, 2);
        var cognito = new Amazon.CognitoIdentityProvider.AmazonCognitoIdentityProviderClient();
        var userPoolId = System.Environment.GetEnvironmentVariable("COGNITO_USER_POOL_ID") ?? "";
        await cognito.AdminDeleteUserAsync(new Amazon.CognitoIdentityProvider.Model.AdminDeleteUserRequest
        {
            UserPoolId = userPoolId,
            Username = username
        });
        return OkResponse(ApiResponse<object>.Ok(new { success = true }));
    }

    // ── Response helpers ──────────────────────────────────────────────────────

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
