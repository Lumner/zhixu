"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainError = void 0;
exports.failure = failure;
exports.isRecord = isRecord;
exports.parseFields = parseFields;
exports.parseCreate = parseCreate;
exports.parseUpdate = parseUpdate;
exports.validId = validId;
exports.parseList = parseList;
exports.isTask = isTask;
exports.parseTaskReply = parseTaskReply;
exports.parsePageReply = parsePageReply;
const messages = {
    INVALID_INPUT: '输入不合法', UNAUTHORIZED: '本地固定身份无效', NOT_FOUND: '记录或路由不存在',
    CONFLICT: '版本冲突，请重新读取', OP_REUSED: '原编号内容不一致', CAPACITY: '课堂内存容量已满',
    TOO_LARGE: '请求体超过课堂上限', MEDIA_TYPE: '需要JSON请求', METHOD: '方法不支持',
    PROTOCOL: '响应格式不符合课堂协议', INTERNAL: '本地实验处理失败'
};
class DomainError extends Error {
    constructor(code) {
        super(messages[code]);
        this.code = code;
        this.name = 'DomainError';
    }
}
exports.DomainError = DomainError;
function failure(code) { return { ok: false, error: { code, message: messages[code] } }; }
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function shape(value, keys) {
    if (!isRecord(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.prototype.hasOwnProperty.call(value, key)))
        throw new DomainError('INVALID_INPUT');
    return value;
}
function parseFields(value) {
    const data = shape(value, ['title', 'done', 'priority']);
    if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 40
        || typeof data.done !== 'boolean' || (data.priority !== 'normal' && data.priority !== 'high'))
        throw new DomainError('INVALID_INPUT');
    return { title: data.title.trim(), done: data.done, priority: data.priority };
}
function parseOp(value) {
    if (typeof value !== 'string' || !/^operation_[A-Za-z0-9_-]{8,64}$/.test(value))
        throw new DomainError('INVALID_INPUT');
    return value;
}
function parseCreate(value) {
    const data = shape(value, ['opId', 'fields']);
    return { opId: parseOp(data.opId), fields: parseFields(data.fields) };
}
function parseUpdate(value) {
    const data = shape(value, ['opId', 'version', 'fields']);
    if (!Number.isSafeInteger(data.version) || typeof data.version !== 'number' || data.version < 1)
        throw new DomainError('INVALID_INPUT');
    return { opId: parseOp(data.opId), version: data.version, fields: parseFields(data.fields) };
}
function validId(value) { return typeof value === 'string' && /^t\d{4}$/.test(value); }
function parseList(value) {
    if (!isRecord(value) || Object.keys(value).some(key => !['limit', 'cursor'].includes(key)))
        throw new DomainError('INVALID_INPUT');
    const limitText = value.limit === undefined ? '5' : value.limit;
    if (typeof limitText !== 'string' || !/^[1-9]\d?$/.test(limitText) || Number(limitText) > 20)
        throw new DomainError('INVALID_INPUT');
    const cursor = value.cursor === undefined ? null : value.cursor;
    if (cursor !== null && !validId(cursor))
        throw new DomainError('INVALID_INPUT');
    return { limit: Number(limitText), cursor };
}
function isTask(value) {
    try {
        const data = shape(value, ['id', 'version', 'title', 'done', 'priority']);
        const normalized = parseFields({ title: data.title, done: data.done, priority: data.priority });
        if (normalized.title !== data.title)
            return false;
        return validId(data.id) && typeof data.version === 'number' && Number.isSafeInteger(data.version) && data.version > 0;
    }
    catch (_) {
        return false;
    }
}
function unwrap(value) {
    if (!isRecord(value) || typeof value.ok !== 'boolean')
        throw new DomainError('PROTOCOL');
    if (!value.ok) {
        const code = isRecord(value.error) ? value.error.code : null;
        if (typeof code !== 'string' || !Object.prototype.hasOwnProperty.call(messages, code))
            throw new DomainError('PROTOCOL');
        // 不信任服务端任意message，只使用已知错误码的固定公开文案。
        throw new DomainError(code);
    }
    if (Object.keys(value).length !== 2 || !Object.prototype.hasOwnProperty.call(value, 'data'))
        throw new DomainError('PROTOCOL');
    return value.data;
}
function parseTaskReply(value) {
    const data = unwrap(value);
    if (!isTask(data))
        throw new DomainError('PROTOCOL');
    return { id: data.id, version: data.version, title: data.title, done: data.done, priority: data.priority };
}
function parsePageReply(value) {
    const data = unwrap(value);
    if (!isRecord(data) || Object.keys(data).length !== 2 || !Array.isArray(data.items) || data.items.length > 20
        || !data.items.every(isTask) || !(data.nextCursor === null || validId(data.nextCursor))
        || new Set(data.items.map(item => item.id)).size !== data.items.length)
        throw new DomainError('PROTOCOL');
    const rows = data.items;
    if (rows.some((item, index) => index > 0 && item.id <= rows[index - 1].id)
        || (data.nextCursor !== null && (!rows.length || rows[rows.length - 1].id !== data.nextCursor)))
        throw new DomainError('PROTOCOL');
    return { items: rows.map(item => ({ ...item })), nextCursor: data.nextCursor };
}
