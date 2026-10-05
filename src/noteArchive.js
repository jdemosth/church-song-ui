export const ARCHIVE_LIMIT = 100000
const fields = ['title', 'noteDate', 'speakerOrAuthor', 'scriptureReference', 'topic', 'tags']
export function archivePayload(metadata, content) {
  return { ...Object.fromEntries(fields.map(field => [field, metadata[field] || (field === 'noteDate' ? null : '')])), content,
    servicePlanId: metadata.servicePlanId || null, updatedAt: metadata.updatedAt || null }
}
