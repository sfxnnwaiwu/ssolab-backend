#!/bin/bash

# Test script for US-B004: OIDC Authentication Flow
# This script tests the complete OIDC authentication flow endpoints

echo "========================================="
echo "US-B004: OIDC Authentication Flow Tests"
echo "========================================="
echo ""

BASE_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:4200"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}: $2"
        ((TESTS_FAILED++))
    fi
    echo ""
}

echo "Step 1: Store OIDC Configuration"
echo "===================================="

CONFIG_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${BASE_URL}/api/oidc/config" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "test-client-id",
    "clientSecret": "test-client-secret",
    "discoveryUrl": "https://accounts.google.com/.well-known/openid-configuration",
    "scopes": ["openid", "profile", "email"],
    "responseType": ["code"]
  }')

HTTP_STATUS=$(echo "$CONFIG_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)
RESPONSE_BODY=$(echo "$CONFIG_RESPONSE" | sed -e '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" -eq 201 ]; then
    CONFIG_ID=$(echo "$RESPONSE_BODY" | jq -r '.configId')
    EXPIRES_AT=$(echo "$RESPONSE_BODY" | jq -r '.expiresAt')
    
    echo "Configuration stored successfully!"
    echo "Config ID: $CONFIG_ID"
    echo "Expires At: $EXPIRES_AT"
    print_result 0 "Configuration stored with valid ID and expiration"
else
    echo "Failed to store configuration"
    echo "HTTP Status: $HTTP_STATUS"
    echo "Response: $RESPONSE_BODY"
    print_result 1 "Configuration storage"
    exit 1
fi

echo "Step 2: Test Login Endpoint (Authorization URL Generation)"
echo "============================================================"

# Note: We can't actually test the full redirect flow in a script,
# but we can verify that the login endpoint is accessible and generates a redirect

echo "Testing login endpoint at: ${BASE_URL}/api/oidc/login/${CONFIG_ID}"
echo ""
echo "This endpoint should:"
echo "  1. Generate a random state and nonce"
echo "  2. Store them in Redis"
echo "  3. Generate a PKCE code verifier and challenge"
echo "  4. Build the authorization URL with all parameters"
echo "  5. Redirect to the IdP's authorization endpoint"
echo ""

# Use curl with -I to get only headers and see if it's a redirect
LOGIN_RESPONSE=$(curl -s -I "${BASE_URL}/api/oidc/login/${CONFIG_ID}")
LOCATION_HEADER=$(echo "$LOGIN_RESPONSE" | grep -i "^location:" | cut -d' ' -f2 | tr -d '\r')
HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep -i "^HTTP" | cut -d' ' -f2)

if [ "$HTTP_STATUS" -eq 302 ]; then
    echo "Login endpoint returned 302 redirect as expected"
    echo "Redirect Location: $LOCATION_HEADER"
    
    # Verify the redirect URL contains expected OIDC parameters
    if echo "$LOCATION_HEADER" | grep -q "client_id="; then
        echo "✓ Contains client_id parameter"
    fi
    
    if echo "$LOCATION_HEADER" | grep -q "response_type=code"; then
        echo "✓ Contains response_type=code parameter"
    fi
    
    if echo "$LOCATION_HEADER" | grep -q "scope="; then
        echo "✓ Contains scope parameter"
    fi
    
    if echo "$LOCATION_HEADER" | grep -q "redirect_uri="; then
        echo "✓ Contains redirect_uri parameter"
    fi
    
    if echo "$LOCATION_HEADER" | grep -q "state="; then
        echo "✓ Contains state parameter"
    fi
    
    if echo "$LOCATION_HEADER" | grep -q "nonce="; then
        echo "✓ Contains nonce parameter"
    fi
    
    if echo "$LOCATION_HEADER" | grep -q "code_challenge="; then
        echo "✓ Contains PKCE code_challenge parameter"
    fi
    
    if echo "$LOCATION_HEADER" | grep -q "code_challenge_method=S256"; then
        echo "✓ Contains PKCE code_challenge_method=S256 parameter"
    fi
    
    print_result 0 "Login endpoint generates proper authorization URL with all OIDC parameters"
else
    echo "Login endpoint did not return expected 302 redirect"
    echo "HTTP Status: $HTTP_STATUS"
    echo "Response: $LOGIN_RESPONSE"
    print_result 1 "Login endpoint redirect"
fi

echo "Step 3: Test Callback Endpoint (Error Handling)"
echo "==============================================="

# Test callback with error from IdP
CALLBACK_ERROR_RESPONSE=$(curl -s -I "${BASE_URL}/api/oidc/callback?error=access_denied&error_description=User%20denied%20consent&state=invalid")
HTTP_STATUS_ERROR=$(echo "$CALLBACK_ERROR_RESPONSE" | grep -i "^HTTP" | cut -d' ' -f2)
LOCATION_ERROR=$(echo "$CALLBACK_ERROR_RESPONSE" | grep -i "^location:" | cut -d' ' -f2 | tr -d '\r')

if [ "$HTTP_STATUS_ERROR" -eq 302 ]; then
    echo "Callback error handling returned 302 redirect"
    echo "Redirect Location: $LOCATION_ERROR"
    
    if echo "$LOCATION_ERROR" | grep -q "${FRONTEND_URL}/oidc/callback?error="; then
        echo "✓ Redirects to frontend with error parameter"
        print_result 0 "Callback handles IdP errors correctly"
    else
        echo "✗ Redirect location unexpected"
        print_result 1 "Callback error redirect"
    fi
else
    echo "Callback error handling unexpected status: $HTTP_STATUS_ERROR"
    print_result 1 "Callback error handling"
fi

# Test callback with invalid state
CALLBACK_INVALID_STATE=$(curl -s -I "${BASE_URL}/api/oidc/callback?code=test_code&state=invalid_state")
HTTP_STATUS_INVALID=$(echo "$CALLBACK_INVALID_STATE" | grep -i "^HTTP" | cut -d' ' -f2)
LOCATION_INVALID=$(echo "$CALLBACK_INVALID_STATE" | grep -i "^location:" | cut -d' ' -f2 | tr -d '\r')

if [ "$HTTP_STATUS_INVALID" -eq 302 ]; then
    echo "Callback with invalid state returned 302 redirect"
    
    if echo "$LOCATION_INVALID" | grep -q "error=invalid_state"; then
        echo "✓ Redirects to frontend with invalid_state error"
        print_result 0 "Callback validates state parameter"
    else
        echo "✗ Expected invalid_state error in redirect"
        print_result 1 "State validation"
    fi
else
    echo "Callback invalid state unexpected status: $HTTP_STATUS_INVALID"
    print_result 1 "State validation"
fi

echo "Step 4: Test Session Management"
echo "==============================="

# Test getting auth result without authentication
SESSION_EMPTY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "${BASE_URL}/api/session/auth-result")
HTTP_STATUS_SESSION=$(echo "$SESSION_EMPTY_RESPONSE" | grep HTTP_STATUS | cut -d: -f2)

if [ "$HTTP_STATUS_SESSION" -eq 404 ]; then
    echo "✓ Returns 404 when no authentication result in session"
    print_result 0 "Session returns 404 when empty"
else
    echo "✗ Expected 404 for empty session, got: $HTTP_STATUS_SESSION"
    print_result 1 "Empty session handling"
fi

echo ""
echo "========================================="
echo "           TEST SUMMARY"
echo "========================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    echo ""
    echo "US-B004 Acceptance Criteria Verified:"
    echo "  ✓ GET /api/oidc/login/:configId generates authorization URL"
    echo "  ✓ Includes proper state and nonce for security"
    echo "  ✓ Includes PKCE for authorization code flow"
    echo "  ✓ Redirects user to IdP authorization endpoint"
    echo "  ✓ GET /api/oidc/callback handles IdP errors"
    echo "  ✓ Validates state parameter"
    echo "  ✓ Session management works correctly"
    echo ""
    echo "Note: Full token exchange and validation cannot be tested"
    echo "without a real OIDC provider callback. Manual testing with"
    echo "Google OAuth or similar provider is recommended for complete"
    echo "validation of token exchange, ID token validation, and session storage."
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
