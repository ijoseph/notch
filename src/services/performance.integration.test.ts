import { expect, test } from 'bun:test';

test('performance bounds preserve search, resource and preview correctness', async () => {
  const run = Bun.spawn([process.execPath, 'run', 'scripts/test-performance-regressions.ts'], {
    cwd: new URL('../..', import.meta.url).pathname, stdout: 'pipe', stderr: 'pipe',
  });
  const [exitCode, stdout, stderr] = await Promise.all([run.exited, new Response(run.stdout).text(), new Response(run.stderr).text()]);
  expect({exitCode, stderr}).toEqual({exitCode:0, stderr:''});
  expect(stdout.match(/^PASS /gm)).toHaveLength(4);
}, 30_000);
