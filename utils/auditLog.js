const { query } = require('../db/database');

/**
 * Write an audit log entry. Fire-and-forget — never awaited by callers.
 * @param {object} user        - req.session.user { email, name, role }
 * @param {string} action      - e.g. 'LOGIN', 'CREATE_ENTRY_DRAFT'
 * @param {string} entityType  - 'journal_entry' | 'receivable' | 'payable' | 'auth' | null
 * @param {number} entityId    - primary key of the entity
 * @param {string} entityRef   - human-readable ref (e.g. 'JE-0001')
 * @param {object} details     - any extra data (will be JSON-stringified)
 */
async function logAction(user, action, entityType = null, entityId = null, entityRef = null, details = null) {
  try {
    await query(
      `INSERT INTO audit_logs (user_email, user_name, user_role, action, entity_type, entity_id, entity_ref, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user?.email  || 'unknown',
        user?.name   || user?.email || 'Unknown',
        user?.role   || 'unknown',
        action,
        entityType,
        entityId,
        entityRef,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (e) {
    console.error('[AuditLog] Failed to write log:', e.message);
  }
}

module.exports = { logAction };
