const { getDB } = require('../db/database');

/**
 * Write an audit log entry. Safe to call from any route handler.
 * @param {object} user  - req.session.user  { email, name, role }
 * @param {string} action      - e.g. 'LOGIN', 'CREATE_ENTRY_DRAFT', 'SUBMIT_FOR_APPROVAL'
 * @param {string} entityType  - 'journal_entry' | 'receivable' | 'payable' | 'setting' | 'auth' | null
 * @param {number} entityId    - primary key of the entity
 * @param {string} entityRef   - human-readable ref (e.g. 'JE-0001')
 * @param {object} details     - any extra data (will be JSON-stringified)
 */
function logAction(user, action, entityType = null, entityId = null, entityRef = null, details = null) {
  try {
    const db = getDB();
    db.prepare(`
      INSERT INTO audit_logs (user_email, user_name, user_role, action, entity_type, entity_id, entity_ref, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user?.email  || 'unknown',
      user?.name   || user?.email || 'Unknown',
      user?.role   || 'unknown',
      action,
      entityType,
      entityId,
      entityRef,
      details ? JSON.stringify(details) : null,
    );
  } catch (e) {
    console.error('[AuditLog] Failed to write log:', e.message);
  }
}

module.exports = { logAction };
