import OpenAI from "openai";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";

function getApiKey() {
  // 兼容当前 DeepSeek 配置和未来可能切回 OpenAI 的场景。
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("缺少 DEEPSEEK_API_KEY。");
  }

  return apiKey;
}

export function createModelClient() {
  return new OpenAI({
    apiKey: getApiKey(),
    baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL
  });
}

export function getModelName() {
  return process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
}

function isBusyModelError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    return error.status === 503 || /too busy/i.test(error.message);
  }

  return error instanceof Error && /503|too busy/i.test(error.message);
}

function isRetryableModelError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429 || error.status === 500 || error.status === 502 || error.status === 503 || error.status === 504;
  }

  return false;
}

export function toReadableModelError(error: unknown) {
  if (isBusyModelError(error)) {
    return new Error("当前 AI 服务繁忙，请稍后重试。");
  }

  if (error instanceof OpenAI.APIError) {
    return new Error(`AI 服务调用失败（${error.status ?? "未知状态"}）。`);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("AI 服务调用失败。");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runModelRequest<T>(request: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;

      // 这里只对常见瞬时错误做一次轻量重试，避免把所有失败都直接暴露给用户。
      if (!isRetryableModelError(error) || attempt === 1) {
        throw toReadableModelError(error);
      }

      await sleep(500 * (attempt + 1));
    }
  }

  throw toReadableModelError(lastError);
}
