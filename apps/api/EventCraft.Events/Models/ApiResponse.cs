namespace EventCraft.Events.Models;

public class ApiResponse<T>
{
  public bool Success { get; set; }
  public T? Data { get; set; }
  public string? Error { get; set; }
  public string? Code { get; set; }

  public static ApiResponse<T> Ok(T data)
      => new() { Success = true, Data = data };

  public static ApiResponse<T> Fail(string error, string? code = null)
      => new() { Success = false, Error = error, Code = code };
}

public class PaginatedResponse<T>
{
  public List<T> Items { get; set; } = new();
  public string? NextCursor { get; set; }
}
