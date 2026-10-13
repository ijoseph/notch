import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import MarkdownCell from '../../src/components/Editor/cells/MarkdownCell';
import '../../src/styles/index.css';

const fixture = '> First blockquote\n> Second blockquote\n\nTyping below the quotes: ';
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function Harness() {
  const [data, setData] = useState(fixture);
  const [result, setResult] = useState('Ready');
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    const failures: string[] = [];
    const timings: number[] = [];
    let checks = 0;
    const check = (expected: string, quotes: boolean) => {
      const overlay = document.querySelector('.markdown-editor-highlight code')!;
      const textarea = document.querySelector('textarea')!;
      checks++;
      if (overlay.textContent !== expected + '\n' || textarea.value !== expected) failures.push(`Stale text at check ${checks}`);
      if (quotes && overlay.querySelectorAll('.hljs-quote').length !== 2) failures.push(`Unstyled quotes at check ${checks}`);
    };
    const update = async (value: string, quotes = true, delay = 0) => {
      const start = performance.now();
      flushSync(() => setData(value));
      timings.push(performance.now() - start);
      check(value, quotes);
      await new Promise(requestAnimationFrame);
      check(value, quotes);
      if (delay) { await pause(delay); check(value, quotes); }
    };
    // Check every committed overlay and painted frame, not just the settled result.
    let value = fixture;
    await update(value, true, 120);
    for (const ch of 'slow typing') { value += ch; await update(value, true, 120); }
    for (const ch of ' fast typing') { value += ch; await update(value); }
    for (let i = 0; i < 8; i++) { value = value.slice(0, -1); await update(value); }
    await update(fixture + '**pasted bold** _italic_ & <script>not executable</script>');
    await update(fixture + '```js\nconst x = 1;\n```\n# Heading');
    await update(fixture + '```js\nconst x = 1;\n```\n# Heading\n');
    const large = fixture + 'plain text '.repeat(4600);
    await update(large, false);
    if (document.querySelector('.markdown-editor-highlight span')) failures.push('Large-cell fallback unexpectedly highlighted');
    await update(fixture);
    const nearLimit = fixture + 'Some **bold** and _italic_ text.\n'.repeat(1500);
    await update(nearLimit);
    await update(nearLimit + 'x');
    await update(fixture);
    timings.sort((a,b) => a-b);
    setResult(JSON.stringify({ passed: failures.length === 0, checks, failures, renderMedianMs: timings[Math.floor(timings.length/2)], renderMaxMs: Math.max(...timings) }, null, 2));
    setRunning(false);
  };
  return <main style={{ padding: 24, maxWidth: 900 }}>
    <h1>Issue #21: Markdown highlighting</h1>
    <button disabled={running} onClick={run}>Run regression</button>
    <pre role="status" style={{ whiteSpace: 'pre-wrap' }}>{result}</pre>
    <MarkdownCell noteId="synthetic-issue-21" data={data} onChange={setData} onFocus={() => {}} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
