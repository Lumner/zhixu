const { reject, assertKeys, checkId } = require('./domain-base');
const MAX_BYTES = 64 * 1024; // 本课程缩略图上限，不是平台配额。
function decodeImage(value) {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_BYTES / 3) * 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) reject('INVALID_IMAGE', '图片编码或大小不合法');
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.length > MAX_BYTES || buffer.toString('base64') !== value) reject('INVALID_IMAGE', '图片编码或大小不合法');
  const png = buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
    && buffer[buffer.length - 2] === 255 && buffer[buffer.length - 1] === 217;
  if (!png && !jpg) reject('INVALID_IMAGE', '教学版仅接收 PNG/JPEG 图片');
  // 文件特征检查，不等于安全解码、内容审核或移除 EXIF。
  return { buffer, extension: png ? 'png' : 'jpg' };
}
const dto = row => ({ id: row._id, caption: row.caption, extension: row.extension,
  size: row.size, state: row.state, createdAt: row.createdAt });
function createImageService({ store, storage, now, randomId, hash, owned, receiptId, checkReceipt }) {
  async function rowFor(actor, id) {
    checkId(id);
    const row = await store.transaction(tx => tx.get('studyhub_assets', id));
    if (!owned(row, actor)) reject('NOT_FOUND', '图片不存在或不可访问');
    return row;
  }
  async function cleanup(row) {
    try {
      await storage.remove(row.fileID);
      await store.transaction(async tx => {
        const current = await tx.get('studyhub_assets', row._id);
        if (current && current.state === 'deleting') await tx.set('studyhub_assets', row._id, { ...current, state: 'deleted' });
      });
      return false;
    } catch (_) { return true; } // 保留删除状态，可再次清理。
  }
  return {
    async read(actor, event) {
      if (event.action === 'imageList') {
        assertKeys(event, ['action', 'cursor']);
        const cursor = event.cursor === undefined || event.cursor === null ? null : event.cursor;
        if (cursor !== null) checkId(cursor);
        const rows = await store.listImages(actor, cursor, 11), items = rows.slice(0, 10).map(dto);
        return { items, nextCursor: rows.length > 10 ? items[items.length - 1].id : null };
      }
      assertKeys(event, ['action', 'id']);
      const row = await rowFor(actor, event.id);
      if (row.state !== 'active') reject('NOT_FOUND', '图片已删除或正在清理');
      const buffer = await storage.download(row.fileID);
      if (!Buffer.isBuffer(buffer) || buffer.length > MAX_BYTES) throw new Error('Invalid stored image');
      return { id: row._id, extension: row.extension, base64: buffer.toString('base64') };
    },
    async write(actor, event) {
      const rid = receiptId(actor, event.opId);
      if (event.action === 'imageRemove') {
        assertKeys(event, ['action', 'opId', 'id']); checkId(event.id);
        const fingerprint = hash(JSON.stringify({ action: event.action, id: event.id }));
        const row = await store.transaction(async tx => {
          checkReceipt(await tx.get('studyhub_ops', rid), fingerprint);
          const current = await tx.get('studyhub_assets', event.id);
          if (!owned(current, actor)) reject('NOT_FOUND', '图片不存在或不可访问');
          if (current.state === 'active') await tx.set('studyhub_assets', event.id, { ...current, state: 'deleting' });
          await tx.set('studyhub_ops', rid, { ...actor, fingerprint, result: { id: event.id, removed: true }, createdAt: now() });
          return current;
        });
        return { id: event.id, removed: true, cleanupPending: row.state === 'deleted' ? false : await cleanup(row) };
      }
      assertKeys(event, ['action', 'opId', 'caption', 'base64']);
      if (typeof event.caption !== 'string' || !event.caption.trim() || event.caption.length > 40) reject('INVALID_INPUT', '图片标题须为 1—40 个代码单元');
      const { buffer, extension } = decodeImage(event.base64), caption = event.caption.trim();
      const fingerprint = hash(JSON.stringify({ action: event.action, caption, contentHash: hash(buffer) }));
      const old = await store.transaction(async tx => checkReceipt(await tx.get('studyhub_ops', rid), fingerprint));
      if (old) return old.result;
      const candidateId = randomId(); // 物理上传路径每次唯一；重试不会覆盖赢家文件。
      const cloudPath = 'studyhub-private/' + hash(JSON.stringify(actor)) + '/' + candidateId + '.' + extension;
      const candidate = { ...actor, cloudPath, state: 'uploading', createdAt: now() };
      await store.transaction(tx => tx.set('studyhub_uploads', candidateId, candidate));
      const fileID = await storage.upload(cloudPath, buffer);
      if (typeof fileID !== 'string' || !fileID) throw new Error('Missing file ID');
      await store.transaction(tx => tx.set('studyhub_uploads', candidateId, { ...candidate, fileID, state: 'uploaded' }));
      const result = await store.transaction(async tx => {
        const receipt = checkReceipt(await tx.get('studyhub_ops', rid), fingerprint);
        if (receipt) return receipt.result;
        const upload = await tx.get('studyhub_uploads', candidateId);
        if (!upload || upload.state !== 'uploaded') throw new Error('Candidate not ready');
        const asset = { _id: candidateId, ...actor, fileID, caption, extension, size: buffer.length, state: 'active', createdAt: now() };
        await tx.set('studyhub_assets', candidateId, asset);
        await tx.set('studyhub_uploads', candidateId, { ...upload, state: 'attached' });
        await tx.set('studyhub_ops', rid, { ...actor, fingerprint, result: dto(asset), createdAt: now() });
        return dto(asset);
      });
      if (result.id !== candidateId) {
        // 明确读到另一赢家，才清理本次未引用文件；提交异常时不能猜测并删文件。
        try {
          await storage.remove(fileID);
          await store.transaction(tx => tx.set('studyhub_uploads', candidateId, { ...candidate, fileID, state: 'discarded' }));
        } catch (_) { /* uploaded 日志留给管理员核对。 */ }
      }
      return result;
    }
  };
}
module.exports = { createImageService, decodeImage, MAX_BYTES };
