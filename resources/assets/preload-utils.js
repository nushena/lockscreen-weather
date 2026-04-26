export async function retryImmediately(task, attempts = 3) {
  let lastError;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function preloadItems(items, attempts = 2) {
  const results = await Promise.all(
    items.map(async ({ key, task }) => {
      try {
        const value = await retryImmediately(task, attempts);
        return {
          key,
          ok: true,
          value,
        };
      } catch (error) {
        return {
          key,
          ok: false,
          error,
        };
      }
    }),
  );

  return {
    allReady: results.every((item) => item.ok),
    items: results,
  };
}
