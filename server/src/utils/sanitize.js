/**
 * Sanitize user input for Bitable filter expressions.
 * Escapes double quotes to prevent filter injection.
 */
function sanitizeFilterValue(val) {
  return String(val).replace(/"/g, '\\"')
}

module.exports = { sanitizeFilterValue }
