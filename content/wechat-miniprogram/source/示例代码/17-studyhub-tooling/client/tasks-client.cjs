const { parsePageReply, parseTaskReply, DomainError } = require('../dist/contracts.js');
function createTasksClient({ request }) {
  async function call(method,url,data,parse,status) {
    // 不自动重试写入，不重新生成opId；身份与传输由调用方显式提供。
    const response = await request({ method,url,data });
    if (!response || typeof response.statusCode !== 'number') throw new DomainError('PROTOCOL');
    if (response.statusCode !== status) {
      if (response.data && response.data.ok === false) parse(response.data);
      throw new DomainError('PROTOCOL');
    }
    return parse(response.data);
  }
  return {
    list(cursor = null) { const query = cursor === null ? '' : '&cursor=' + encodeURIComponent(cursor); return call('GET','/v1/tasks?limit=5'+query,undefined,parsePageReply,200); },
    create(opId,fields) { return call('POST','/v1/tasks',{opId,fields},parseTaskReply,201); },
    update(id,opId,version,fields) { return call('PATCH','/v1/tasks/'+encodeURIComponent(id),{opId,version,fields},parseTaskReply,200); }
  };
}
module.exports = { createTasksClient };
