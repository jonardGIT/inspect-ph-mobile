import { ApiRequestError, login, registerPushToken } from "@/lib/api";

jest.mock("@/lib/api-base-url", () => ({
  API_BASE_URL: "http://test-api:4000/api/v1",
}));

describe("mobile api request handling", () => {
  beforeEach(() => {
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: jest.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("handles empty-body success responses", async () => {
    const fetchMock = global.fetch as jest.Mock;

    fetchMock.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      text: async () => "",
    });

    await expect(
      registerPushToken({
        accessToken: "test-token",
        token: "push-token",
      }),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://test-api:4000/api/v1/auth/push-token",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("returns ApiRequestError with API JSON error message", async () => {
    const fetchMock = global.fetch as jest.Mock;

    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () =>
        JSON.stringify({
          error: {
            message: "Invalid credentials",
          },
        }),
    });

    await expect(
      login({
        email: "user@example.com",
        password: "wrong-password",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        message: "Invalid credentials",
        name: "ApiRequestError",
        status: 401,
      }),
    );
  });

  it("returns ApiRequestError for non-JSON error bodies using HTTP status text", async () => {
    const fetchMock = global.fetch as jest.Mock;

    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: async () => "<html>upstream failed</html>",
    });

    await expect(
      login({
        email: "user@example.com",
        password: "password",
      }),
    ).rejects.toEqual(new ApiRequestError(502, "Bad Gateway"));
  });
});
