const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function uuid(value,label='ID') {
  if(typeof value!=='string'||!uuidPattern.test(value))throw new TypeError(`Invalid ${label}.`);
  return value.toLowerCase();
}
// Call only with a server-authenticated identity, never raw request headers.
export function requestContext({organizationId,userId}={}) {
  return Object.freeze({organizationId:uuid(organizationId,'organization ID'),userId:uuid(userId,'user ID')});
}
