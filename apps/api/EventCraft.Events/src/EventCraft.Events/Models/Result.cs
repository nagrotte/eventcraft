namespace EventCraft.Events.Models;

/// <summary>
/// Represents the outcome of an operation — success with data or failure with error.
/// Never throw exceptions for expected business conditions; return Result instead.
/// </summary>
public sealed class Result<T>
{
    public bool    IsSuccess { get; }
    public bool    IsFailure => !IsSuccess;
    public T?      Value     { get; }
    public string? Error     { get; }
    public string? ErrorCode { get; }
    public int     StatusCode { get; }

    private Result(bool isSuccess, T? value, string? error, string? errorCode, int statusCode)
    {
        IsSuccess  = isSuccess;
        Value      = value;
        Error      = error;
        ErrorCode  = errorCode;
        StatusCode = statusCode;
    }

    public static Result<T> Ok(T value)
        => new(true, value, null, null, 200);

    public static Result<T> Created(T value)
        => new(true, value, null, null, 201);

    public static Result<T> Fail(string error, string errorCode = "ERROR", int statusCode = 400)
        => new(false, default, error, errorCode, statusCode);

    public static Result<T> NotFound(string error = "Resource not found")
        => new(false, default, error, "NOT_FOUND", 404);

    public static Result<T> Unauthorized(string error = "Unauthorized")
        => new(false, default, error, "UNAUTHORIZED", 401);

    public static Result<T> ServerError(string error = "Internal server error")
        => new(false, default, error, "SERVER_ERROR", 500);

    /// <summary>Maps the value if successful, propagates failure otherwise.</summary>
    public Result<TOut> Map<TOut>(Func<T, TOut> mapper)
        => IsSuccess && Value is not null
            ? Result<TOut>.Ok(mapper(Value))
            : Result<TOut>.Fail(Error!, ErrorCode!, StatusCode);
}

/// <summary>Non-generic Result for commands that return no value.</summary>
public sealed class Result
{
    public bool    IsSuccess  { get; }
    public bool    IsFailure  => !IsSuccess;
    public string? Error      { get; }
    public string? ErrorCode  { get; }
    public int     StatusCode { get; }

    private Result(bool isSuccess, string? error, string? errorCode, int statusCode)
    {
        IsSuccess  = isSuccess;
        Error      = error;
        ErrorCode  = errorCode;
        StatusCode = statusCode;
    }

    public static Result Ok()           => new(true, null, null, 200);
    public static Result NoContent()    => new(true, null, null, 204);

    public static Result Fail(string error, string errorCode = "ERROR", int statusCode = 400)
        => new(false, error, errorCode, statusCode);

    public static Result NotFound(string error = "Resource not found")
        => new(false, error, "NOT_FOUND", 404);

    public static Result ServerError(string error = "Internal server error")
        => new(false, error, "SERVER_ERROR", 500);
}
