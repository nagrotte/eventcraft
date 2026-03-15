using Amazon.Lambda.Core;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.RuntimeSupport;
using Amazon.Lambda.Serialization.SystemTextJson;
using Amazon.DynamoDBv2;
using EventCraft.Events.Commands;
using EventCraft.Events.Queries;
using EventCraft.Events.Models;
using EventCraft.Events.Repositories;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Formatting.Compact;
using System.Text.Json;
using System.Text.Json.Serialization;

[assembly: LambdaSerializer(typeof(DefaultLambdaJsonSerializer))]

namespace EventCraft.Events;

public sealed class Function
{
    private static readonly IServiceProvider _services;
    private static readonly IMediator _mediator;
    private static readonly Serilog.ILogger _log;

    // ── JSON options ──────────────────────────────────────────────────────────
    private static readonly JsonSerializerOptions _json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    // ── Static constructor — cold start ───────────────────────────────────────
    static Function()
    {
        var env = Environment.GetEnvironmentVariable("ENVIRONMENT") ?? "staging";
        var tableName = Environment.GetEnvironmentVariable("DYNAMODB_TABLE") ?? $"eventcraft-{env}";
        var sentryDsn = Environment.GetEnvironmentVariable("SENTRY_DSN") ?? "";
        var awsRegion = Environment.GetEnvironmentVariable("AWS_REGION") ?? "us-east-1";

        // ── Serilog structured logging → CloudWatch ───────────────────────────
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .Enrich.FromLogContext()
            .Enrich.WithProperty("service", "eventcraft-events")
            .Enrich.WithProperty("environment", env)
            .WriteTo.Console(new CompactJsonFormatter())
            .WriteTo.Sentry(o =>
            {
                o.Dsn = sentryDsn;
                o.MinimumBreadcrumbLevel = Serilog.Events.LogEventLevel.Information;
                o.MinimumEventLevel = Serilog.Events.LogEventLevel.Error;
                o.Environment = env;
            })
            .CreateLogger();

        _log = Log.Logger.ForContext<Function>();
        _log.Information("Cold start: {Environment} / {Table}", env, tableName);

        // ── DI container ──────────────────────────────────────────────────────
        var sc = new ServiceCollection();

        sc.AddSingleton(Log.Logger);

        sc.AddSingleton<IAmazonDynamoDB>(_ =>
            new AmazonDynamoDBClient(Amazon.RegionEndpoint.GetBySystemName(awsRegion)));

        sc.AddSingleton<IEventRepository>(sp =>
            new DynamoEventRepository(
                sp.GetRequiredService<IAmazonDynamoDB>(),
                sp.GetRequiredService<ILogger<DynamoEventRepository>>(),
                tableName));

        sc.AddSingleton<IRsvpRepository>(sp =>
            new DynamoRsvpRepository(
                sp.GetRequiredService<IAmazonDynamoDB>(),
                sp.GetRequiredService<ILogger<DynamoRsvpRepository>>(),
                tableName));

        sc.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Function).Assembly));

        _services = sc.BuildServiceProvider();
        _mediator = _services.GetRequiredService<IMediator>();
    }

    // ── Lambda entry point ────────────────────────────────────────────────────
    public async Task<APIGatewayProxyResponse> FunctionHandler(
        APIGatewayProxyRequest request, ILambdaContext context)
    {
        var method = request.HttpMethod?.ToUpper() ?? "GET";
        var path = request.Path ?? "";

        _log.Information("Request: {Method} {Path}", method, path);

        try
        {
            return (method, path) switch
            {
                ("GET", "/health") => HealthCheck(),
                ("GET", var p) when p.StartsWith("/events/") &&
                                       p.EndsWith("/rsvp/summary") => await GetRsvpSummary(request),
                ("POST", var p) when p.StartsWith("/events/") &&
                                       p.EndsWith("/rsvp") => await SubmitRsvp(request),
                ("GET", "/events") => await ListEvents(request),
                ("POST", "/events") => await CreateEvent(request),
                ("GET", var p) when p.StartsWith("/events/") => await GetEvent(request),
                ("PUT", var p) when p.StartsWith("/events/")
                                       && p.EndsWith("/publish") => await PublishEvent(request),
                ("PUT", var p) when p.StartsWith("/events/") => await UpdateEvent(request),
                ("DELETE", var p) when p.StartsWith("/events/") => await DeleteEvent(request),
                _ => NotFound()
            };
        }
        catch (Exception ex)
        {
            _log.Error(ex, "Unhandled exception: {Method} {Path}", method, path);
            return ServerError("An unexpected error occurred");
        }
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    private static APIGatewayProxyResponse HealthCheck()
        => Ok(new
        {
            status = "ok",
            service = "eventcraft-events",
            environment = Environment.GetEnvironmentVariable("ENVIRONMENT") ?? "staging",
            timestamp = DateTime.UtcNow.ToString("O")
        });

    private async Task<APIGatewayProxyResponse> CreateEvent(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return Unauthorized();

        var body = Deserialize<CreateEventRequest>(req.Body);
        if (body is null) return BadRequest("Invalid request body");

        var result = await _mediator.Send(new CreateEventCommand(userId, body));
        return ToResponse(result, 201);
    }

    private async Task<APIGatewayProxyResponse> GetEvent(APIGatewayProxyRequest req)
    {
        var eventId = GetPathSegment(req.Path, 2);
        var userId = GetUserId(req);
        var result = await _mediator.Send(new GetEventQuery(eventId, userId));
        return ToResponse(result);
    }

    private async Task<APIGatewayProxyResponse> ListEvents(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return Unauthorized();

        string? limitStr = null;
        string? cursor = null;
        req.QueryStringParameters?.TryGetValue("limit", out limitStr);
        req.QueryStringParameters?.TryGetValue("cursor", out cursor);
        int.TryParse(limitStr ?? "20", out var limit);
        var result = await _mediator.Send(new ListEventsQuery(userId, limit > 0 ? limit : 20, cursor));
        return ToResponse(result);
    }

    private async Task<APIGatewayProxyResponse> UpdateEvent(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return Unauthorized();

        var eventId = GetPathSegment(req.Path, 2);
        var body = Deserialize<UpdateEventRequest>(req.Body);
        if (body is null) return BadRequest("Invalid request body");

        var result = await _mediator.Send(new UpdateEventCommand(eventId, userId, body));
        return ToResponse(result);
    }

    private async Task<APIGatewayProxyResponse> PublishEvent(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return Unauthorized();

        var eventId = GetPathSegment(req.Path, 2);
        var body = Deserialize<PublishEventRequest>(req.Body);
        if (body is null) return BadRequest("Invalid request body");

        var result = await _mediator.Send(new PublishEventCommand(eventId, userId, body));
        return ToResponse(result);
    }

    private async Task<APIGatewayProxyResponse> DeleteEvent(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return Unauthorized();

        var eventId = GetPathSegment(req.Path, 2);
        var result = await _mediator.Send(new DeleteEventCommand(eventId, userId));
        return result.IsSuccess ? NoContent() : ToResponse(result);
    }

    private async Task<APIGatewayProxyResponse> SubmitRsvp(APIGatewayProxyRequest req)
    {
        var eventId = GetPathSegment(req.Path, 2);
        var body = Deserialize<SubmitRsvpRequest>(req.Body);
        if (body is null) return BadRequest("Invalid request body");

        var result = await _mediator.Send(new SubmitRsvpCommand(eventId, body));
        return ToResponse(result);
    }

    private async Task<APIGatewayProxyResponse> GetRsvpSummary(APIGatewayProxyRequest req)
    {
        var userId = GetUserId(req);
        if (userId is null) return Unauthorized();

        var eventId = GetPathSegment(req.Path, 2);
        var result = await _mediator.Send(new GetRsvpSummaryQuery(eventId, userId));
        return ToResponse(result);
    }

    // ── Response helpers ──────────────────────────────────────────────────────

    private static APIGatewayProxyResponse ToResponse<T>(Result<T> result, int successCode = 200)
        => result.IsSuccess
            ? JsonResponse(successCode, ApiResponse<T>.Ok(result.Value!))
            : JsonResponse(result.StatusCode, ApiResponse<T>.Fail(result.Error!, result.ErrorCode));

    private static APIGatewayProxyResponse ToResponse(Result result)
        => result.IsSuccess
            ? JsonResponse(204, null)
            : JsonResponse(result.StatusCode, ApiResponse<object>.Fail(result.Error!, result.ErrorCode));

    private static APIGatewayProxyResponse Ok(object data)
        => JsonResponse(200, data);

    private static APIGatewayProxyResponse NoContent()
        => new() { StatusCode = 204, Headers = CorsHeaders() };

    private static APIGatewayProxyResponse BadRequest(string message)
        => JsonResponse(400, ApiResponse<object>.Fail(message, "BAD_REQUEST"));

    private static APIGatewayProxyResponse Unauthorized()
        => JsonResponse(401, ApiResponse<object>.Fail("Unauthorized", "UNAUTHORIZED"));

    private static APIGatewayProxyResponse NotFound()
        => JsonResponse(404, ApiResponse<object>.Fail("Not found", "NOT_FOUND"));

    private static APIGatewayProxyResponse ServerError(string message)
        => JsonResponse(500, ApiResponse<object>.Fail(message, "SERVER_ERROR"));

    private static APIGatewayProxyResponse JsonResponse(int statusCode, object? body)
        => new()
        {
            StatusCode = statusCode,
            Headers = CorsHeaders(),
            Body = body is null ? null : JsonSerializer.Serialize(body, _json)
        };

    private static Dictionary<string, string> CorsHeaders()
        => new()
        {
            ["Content-Type"] = "application/json",
            ["Access-Control-Allow-Origin"] = "*",
            ["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS",
            ["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        };

    // ── Utility ───────────────────────────────────────────────────────────────

    private static string? GetUserId(APIGatewayProxyRequest req)
        => req.RequestContext?.Authorizer?.TryGetValue("claims", out var c) == true &&
           c is System.Text.Json.JsonElement el &&
           el.TryGetProperty("sub", out var sub)
            ? sub.GetString()
            : null;

    private static string GetPathSegment(string path, int index)
    {
        var parts = path.Trim('/').Split('/');
        return parts.Length > index ? parts[index] : "";
    }

    private static T? Deserialize<T>(string? body) where T : class
    {
        if (string.IsNullOrWhiteSpace(body)) return null;
        try { return JsonSerializer.Deserialize<T>(body, _json); }
        catch { return null; }
    }

    // ── Bootstrap (custom runtime entry) ─────────────────────────────────────
    public static async Task Main()
    {
        var handler = new Function();
        await LambdaBootstrapBuilder
            .Create<APIGatewayProxyRequest, APIGatewayProxyResponse>(
                handler.FunctionHandler, new DefaultLambdaJsonSerializer())
            .Build()
            .RunAsync();
    }
}
