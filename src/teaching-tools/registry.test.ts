import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEACHING_TOOLS, SUBJECTS, getTool } from './registry.ts';

test('注册表：所有工具字段完整且合规', () => {
  const ids = new Set<string>();
  for (const t of TEACHING_TOOLS) {
    assert.ok(t.id, `id 非空`);
    assert.ok(!ids.has(t.id), `id 唯一：${t.id}`);
    ids.add(t.id);
    assert.ok(t.name, `名称非空：${t.id}`);
    assert.ok(SUBJECTS.includes(t.subject), `学科合法：${t.subject} -> ${t.id}`);
    assert.ok(t.license && t.license.length > 0, `许可证非空：${t.id}`);
    assert.ok(t.sourceUrl.startsWith('http'), `来源 URL 合法：${t.sourceUrl}`);
    assert.ok(t.sourceName, `来源名称非空：${t.id}`);
    assert.ok(
      ['local-iframe', 'remote-iframe', 'link'].includes(t.loadMode),
      `loadMode 合法：${t.loadMode} -> ${t.id}`,
    );
    assert.ok(Array.isArray(t.paramsSchema), `paramsSchema 是数组：${t.id}`);
    assert.ok(t.defaultParams && typeof t.defaultParams === 'object', `defaultParams 是对象：${t.id}`);
    if (t.loadMode === 'local-iframe') assert.ok(t.localPath, `local-iframe 需要 localPath：${t.id}`);
    if (t.loadMode !== 'local-iframe') assert.ok(t.entryUrl, `非 local 需要 entryUrl：${t.id}`);
  }
});

test('注册表：至少 3 个离线（local-iframe）工具', () => {
  const offline = TEACHING_TOOLS.filter((t) => t.offline && t.loadMode === 'local-iframe');
  assert.ok(offline.length >= 3, `离线工具至少 3 个，实际 ${offline.length}`);
});

test('getTool：能按 id 取回工具', () => {
  assert.equal(getTool('cn-math-taxonomy')?.sourceName, 'cn-math-taxonomy');
  assert.equal(getTool('openlab-pendulum')?.license, 'MIT');
  assert.equal(getTool('nonexistent'), undefined);
});
