import { chunk, sendPush } from '../../src/push';

describe('push chunking', () => {
  it('splits into batches of at most 100', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 100)).toEqual([]);
    expect(chunk(Array.from({ length: 250 }, (_, i) => i), 100).map((c) => c.length)).toEqual([100, 100, 50]);
  });
});

describe('sendPush', () => {
  const msgs = Array.from({ length: 250 }, (_, i) => ({ to: `t${i}`, title: 't', body: 'b' }));
  const realFetch = global.fetch;
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  beforeEach(() => {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  });
  afterEach(() => {
    global.fetch = realFetch;
    if (emulator) process.env.FIRESTORE_EMULATOR_HOST = emulator;
    jest.restoreAllMocks();
  });

  it('posts one request per 100 messages with a timeout, and logs a non-ok response without throwing', async () => {
    const calls: any[] = [];
    global.fetch = (async (_url: string, init: any) => {
      calls.push(init);
      return { ok: false, status: 500 } as Response;
    }) as any;
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendPush(msgs)).resolves.toBeUndefined();
    expect(calls.map((c) => JSON.parse(c.body).length)).toEqual([100, 100, 50]);
    expect(calls.every((c) => c.signal instanceof AbortSignal)).toBe(true);
    expect(log).toHaveBeenCalled();
  });

  it('does nothing under the emulator', async () => {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    global.fetch = (() => {
      throw new Error('must not be called');
    }) as any;
    await expect(sendPush(msgs)).resolves.toBeUndefined();
  });
});
