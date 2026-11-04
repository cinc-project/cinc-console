# Cinc Console Login Troubleshooting & Fix

## Investigation Summary

### Problem

- Cinc Console login failing with `403 Forbidden` on `POST /authenticate_user`
- Server error: "missing create permission"
- User is an org admin, but still denied
- Occurs with CINC Server 15.10.114

### Root Cause Analysis

The `/authenticate_user` endpoint may have ACL checks that evaluate the **signing actor** (the webui key identity), not just the impersonated user. Observed on Cinc Server 15.10.114, and may occur on other versions depending on ACL configuration.

### Key Findings

1. **Request signing is correct**: webui key + X-Ops-UserId impersonation headers are properly formatted
2. **User exists and has permissions**: the user is in the admins group and has org membership
3. **/containers/users/_acl edge case**: This is a server bug, not related to cinc-console code paths
4. **The real issue**: Server's /authenticate_user endpoint requires the signing actor (webui) to have "create" permission on something, not just credential validation

## Solution: AuthActor Fallback

A privileged actor fallback mechanism has been implemented to handle servers that require elevated privileges for /authenticate_user.

### How It Works

```text
User enters <username> / <password>:
  ↓
POST /authenticate_user
  - Signed as: webui key
  - Impersonating: <username>
  - X-Ops-UserId: <username>
  ↓
[If 403 AND authActor configured]:
  POST /authenticate_user (retry)
  - Signed as: webui key
  - Impersonating: authActor (e.g., "pivotal" or "webui")
  - X-Ops-UserId: authActor
  ↓
[If either attempt succeeds]:
  ✓ Login success
[If both fail]:
  ✗ Login failure → "server denied authentication"
```

## Configuration

### Enable the Fallback

Set `authActor` to a privileged user that exists on your server and can authenticate:

#### **Option 1: Helm values**

```yaml
authActor: "pivotal"
```

#### **Option 2: Environment variable**

```bash
export CINC_AUTH_ACTOR=pivotal
```

#### **Option 3: In deployment**

```bash
helm install cinc-console ./deploy/helm/cinc-console \
  --set cincServerUrl=https://cinc.example.com \
  --set-file webuiKey=/path/to/webui_priv.pem \
  --set authActor=pivotal
```

### Recommended Values

- For **Cinc Server**: `"pivotal"` or `"webui"` (if configured as a user)
- For **Custom setups**: A service account user that has admin privileges

### Verify Configuration

After deploying with `authActor` set, check the logs:

```text
log level: info, msg: cinc.auth_fallback, user: example-user, reason: 403_from_impersonated_user, fallback_actor: pivotal
```

If the fallback succeeds, you should see:

```text
log level: info, msg: login.success, user: example-user
```

## Changes Made

### Core Code Changes

1. **lib/config.ts**: Added `authActor` configuration
2. **lib/cinc/auth.ts**: Implemented fallback retry logic on 403
3. **app/api/auth/login/route.ts**: Enhanced error handling for 403/5xx
4. **lib/cinc/client.ts**: Added debug logging for authenticate_user requests

### Helm Configuration

1. **deploy/helm/cinc-console/templates/configmap.yaml**: Added CINC_AUTH_ACTOR env var
2. **deploy/helm/cinc-console/values.yaml**: Documented authActor option

### Tests

1. **lib/config.test.ts**: Tests for authActor configuration parsing
2. **lib/cinc/auth.test.ts**: Tests for fallback retry behavior

## Testing the Fix

### Without authActor (Default Behavior)

```bash
# Deploy normally - no change to existing behavior
helm install cinc-console ./deploy/helm/cinc-console \
  --set cincServerUrl=https://cinc.example.com \
  --set-file webuiKey=/path/to/webui_priv.pem
```

### With authActor (New Fallback)

```bash
# Deploy with fallback
helm install cinc-console ./deploy/helm/cinc-console \
  --set cincServerUrl=https://cinc.example.com \
  --set-file webuiKey=/path/to/webui_priv.pem \
  --set authActor=pivotal
```

### Debugging

Enable verbose logging to see the auth flow:

1. Check pod logs for `cinc.auth_request` messages
2. Look for `cinc.request_failed` with status 403. Its `actor` is who signed
   the request and `user` is who it was for; on a login they differ
   (`actor` is `CINC_AUTH_ACTOR`, `user` is the person logging in)
3. See if `cinc.auth_fallback` is triggered
4. Verify `login.success` or `login.failed`

### Step-by-Step Test

1. Deploy with `authActor: pivotal`
2. Try logging in as your test user
3. Check pod logs:

   ```bash
   kubectl logs -f deployment/cinc-console | grep -E "cinc.auth|login"
   ```

4. Expected log sequence:
   - `cinc.auth_request` (first attempt)
   - `cinc.request_failed` with status 403 (first attempt fails)
   - `cinc.auth_fallback` (retry as pivotal triggered)
   - `cinc.auth_request` (second attempt as pivotal)
   - `login.success` (login succeeds)

## Fallback Behavior Details

### When Does Fallback Trigger?

- Impersonated user receives 403 **AND** authActor is configured
- Does NOT trigger on: 401 (bad credentials), 5xx (server errors)

### What Happens to 401 vs 403?

- **401 (Unauthorized)**: Bad credentials → Returns null → Login fails with "invalid username or password"
- **403 (Forbidden)**: Access denied → Attempts fallback → If authActor not set, treated as auth failure

### What If Fallback Also Fails?

- Original error is re-thrown
- Login route catches it and returns "server denied authentication"
- Logs show both attempts failed

## Monitoring & Logging

New log entries added:

### During Normal Login

```json
{
  "level": "info",
  "msg": "cinc.auth_request",
  "method": "POST",
  "path": "/authenticate_user",
  "userId": "example-user",
  "xOpsUserId": "example-user",
  "xOpsRequestSource": "web",
  "hasSigning": true
}
```

### On 403 with Fallback

```json
{
  "level": "info",
  "msg": "cinc.auth_fallback",
  "user": "example-user",
  "reason": "403_from_impersonated_user",
  "fallback_actor": "pivotal"
}
```

### On Fallback Failure

```json
{
  "level": "warn",
  "msg": "cinc.auth_fallback_failed",
  "user": "example-user",
  "actor": "pivotal",
  "status": 403
}
```

## Backward Compatibility

- **No breaking changes**: Without `authActor` configured, behavior is identical to before
- **Existing deployments unaffected**: If authActor is not set, fallback does not trigger
- **Gradual adoption**: Set authActor only on deployments where needed

## Additional Notes

### Why This Happens

Some Cinc server versions have ACL enforcement on the `/authenticate_user` endpoint itself. The server may check if the signing actor (webui) has permission to validate users, even though the endpoint is being called to authenticate a different user.

### Why This Works as a Fix

By allowing fallback to a privileged actor (pivotal or webui), we ensure that the actor making the request has sufficient permissions for the server's ACL checks, while still validating the correct user's credentials in the request body.

### When This is NOT Needed

- If your CINC Server 15.10.114 is already configured to allow webui to call /authenticate_user without additional permissions
- If you're using Cinc server versions that don't enforce ACLs on /authenticate_user
- If you update the server ACLs to permit webui access (alternative fix)

### Testing Against cinc-server-ng

When testing against [cinc-server-ng](https://github.com/cinc-project/cinc-server-ng)
(formerly cinc-zero), run it with auth on, not with `--no-auth` or `make run-dev`:

```bash
# cinc-server-ng in one terminal, from its repo (listens on 127.0.0.1:8889)
cinc-server-ng --state dev/test-repo --key-out /tmp/webui.pem

# Then in cinc-console with fallback disabled (default), and log in as tim / tim123:
CINC_SERVER_URL=http://127.0.0.1:8889 \
CINC_WEBUI_KEY=$(cat /tmp/webui.pem) \
pnpm dev
```

If you encounter 403 errors at login with cinc-server-ng, try:

```bash
CINC_SERVER_URL=http://127.0.0.1:8889 \
CINC_WEBUI_KEY=$(cat /tmp/webui.pem) \
CINC_AUTH_ACTOR=pivotal \
pnpm dev
```
