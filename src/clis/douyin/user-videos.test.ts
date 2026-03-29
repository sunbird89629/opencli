import { describe, expect, it, vi } from 'vitest';
import { ArgumentError, CommandExecutionError } from '../../errors.js';
import { getRegistry } from '../../registry.js';
import './user-videos.js';

function makePage(...evaluateResults: unknown[]) {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    wait: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn()
      .mockImplementation(() => Promise.resolve(evaluateResults.shift())),
  } as any;
}

describe('douyin user-videos command', () => {
  it('throws ArgumentError when limit is not a positive integer', async () => {
    const cmd = getRegistry().get('douyin/user-videos');
    const page = makePage();

    await expect(cmd!.func!(page, { sec_uid: 'test', limit: 0 })).rejects.toThrow(ArgumentError);
    expect(page.goto).not.toHaveBeenCalled();
  });

  it('surfaces top-level Douyin API errors through browserFetch semantics', async () => {
    const cmd = getRegistry().get('douyin/user-videos');
    const page = makePage({ status_code: 8, status_msg: 'bad uid' });

    await expect(cmd!.func!(page, { sec_uid: 'bad', limit: 3 })).rejects.toThrow(CommandExecutionError);
    expect(page.goto).toHaveBeenCalledWith('https://www.douyin.com/user/bad');
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  it('passes normalized limit to the API and preserves mapped rows', async () => {
    const cmd = getRegistry().get('douyin/user-videos');
    const page = makePage(
      {
        aweme_list: [{
          aweme_id: '1',
          desc: 'Video 1',
          video: { duration: 2300, play_addr: { url_list: ['https://video.example/1.mp4'] } },
          statistics: { digg_count: 12 },
        }],
      },
      [{ aweme_id: '1', desc: 'Video 1', video: { duration: 2300, play_addr: { url_list: ['https://video.example/1.mp4'] } }, statistics: { digg_count: 12 }, top_comments: [] }],
    );

    const rows = await cmd!.func!(page, { sec_uid: 'good', limit: 1 });

    expect(page.evaluate).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('count=1'),
    );
    expect(rows).toEqual([{
      index: 1,
      aweme_id: '1',
      title: 'Video 1',
      duration: 2,
      digg_count: 12,
      play_url: 'https://video.example/1.mp4',
      top_comments: [],
    }]);
  });
});
