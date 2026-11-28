const Ajv = require('ajv');
const domain = require('./schemas/domain.schema.json');
const registry = require('./events.json');
const { semantic } = require('./semantics.cjs');
const ajv = new Ajv({ allErrors: true });
ajv.addSchema(domain);
for (const entry of registry) ajv.addSchema(require(entry.schema));
function validateEvent(event) {
  const entry = registry.find((item) => item.eventType === event?.eventType);
  if (!entry || event.version !== 2 || !ajv.getSchema(entry.schemaId)(event))
    throw new Error('INVALID_EVENT_SCHEMA');
  try {
    semantic(event, entry.payloadDefinition);
  } catch {
    throw new Error('INVALID_EVENT_SEMANTICS');
  }
  return entry.routingKey;
}
function validateRequest(definition, value) {
  const validator = ajv.getSchema(domain.$id + '#/definitions/' + definition);
  if (!validator || !validator(value)) throw new Error('INVALID_REQUEST_SCHEMA');
  if (
    ['RegisterRequest', 'LoginRequest'].includes(definition) &&
    Buffer.byteLength(value.password, 'utf8') > 72
  )
    throw new Error('INVALID_PASSWORD_BYTES');
  if (definition === 'RegisterRequest' && value.password !== value.confirmPassword)
    throw new Error('PASSWORD_CONFIRMATION_MISMATCH');
  semantic(value, definition === 'VocabularyMediaPresignRequest' ? 'PresignRequest' : definition);
}
module.exports = { validateEvent, validateRequest };
