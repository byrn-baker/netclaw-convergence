export const CHAT_STORAGE_KEY = 'netclaw.standard-chat.v1';
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value);
export function validateChat(value) {
  if (!value || value.version !== 1 || !id(value.thread) || !Array.isArray(value.messages)
      || typeof value.draft !== 'string' || value.draft.length > 20000
      || typeof value.chatModel !== 'string' || value.chatModel.length > 128) throw Error('Invalid saved chat');
  const messages = value.messages.map(message => {
    if (!['user', 'assistant'].includes(message?.role) || typeof message.content !== 'string') throw Error('Invalid message');
    return { role: message.role, content: message.content,
      assessmentRefs: (Array.isArray(message.assessmentRefs) ? message.assessmentRefs : [])
        .filter(ref => id(ref?.taskRef) && id(ref?.assessmentId)).map(({ taskRef, assessmentId }) => ({ taskRef, assessmentId })) };
  });
  return { version: 1, thread: value.thread, messages, draft: value.draft,
    chatModel: value.chatModel, ...(value.chatEffort !== undefined ? { chatEffort: ['','off','minimal','low','medium','high','xhigh','max','ultra'].includes(value.chatEffort) ? value.chatEffort : '' } : {}), interrupted: value.interrupted === true };
}
export function loadChat(storage) {
  try {
    const raw = storage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return { state: null, error: '' };
    if (raw.length > 4 * 1024 * 1024) throw Error('Oversize');
    return { state: validateChat(JSON.parse(raw)), error: '' };
  } catch { return { state: null, error: 'Saved chat could not be read. Browser storage may be unavailable or damaged.' }; }
}
export function saveChat(storage, state) {
  try {
    const raw = JSON.stringify(validateChat({ ...state, version: 1 }));
    if (raw.length > 4 * 1024 * 1024) throw Error('Oversize');
    storage.setItem(CHAT_STORAGE_KEY, raw);
    return '';
  } catch { return 'Chat could not be saved in this tab. Refresh may lose recent messages or your draft.'; }
}

export const CHAT_ARCHIVE_KEY = 'netclaw.chat-archive.v1';
export function loadChatArchive(storage) {
  const raw = storage.getItem(CHAT_ARCHIVE_KEY);
  if (!raw) return [];
  if (raw.length > 4 * 1024 * 1024) throw Error('Saved chats exceed browser storage limit');
  const values = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > 100) throw Error('Invalid saved chats');
  return values.map(value => ({ ...validateChat(value), updatedAt: Number(value.updatedAt) || 0 }));
}
export function archiveChat(storage, state) {
  const chat = validateChat({ ...state, version: 1 });
  const previous = loadChatArchive(storage);
  if (!chat.messages.length && !chat.draft) return previous;
  const chats = [{ ...chat, updatedAt: Date.now() }, ...previous.filter(c => c.thread !== chat.thread)];
  const raw = JSON.stringify(chats);
  if (chats.length > 100 || raw.length > 4 * 1024 * 1024) throw Error('Saved chat storage is full');
  storage.setItem(CHAT_ARCHIVE_KEY, raw);
  return chats;
}
