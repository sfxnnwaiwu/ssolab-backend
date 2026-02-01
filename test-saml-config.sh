#!/bin/bash

# Test SAML Config Endpoint - Valid Request
echo "=== Testing POST /api/saml/config with VALID data ==="
curl -X POST http://localhost:3000/api/saml/config \
  -H "Content-Type: application/json" \
  -d '{
    "idpName": "Test IdP",
    "entityId": "https://idp.example.com",
    "ssoUrl": "https://idp.example.com/saml/sso",
    "certificate": "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKL0UG+mRKJ7MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX\naWRnaXRzIFB0eSBMdGQwHhcNMTkwMTAxMDAwMDAwWhcNMjkwMTAxMDAwMDAwWjBF\nMQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50\nZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEA1234567890\n-----END CERTIFICATE-----"
  }'

echo -e "\n\n=== Testing POST /api/saml/config with INVALID certificate (missing BEGIN marker) ==="
curl -X POST http://localhost:3000/api/saml/config \
  -H "Content-Type: application/json" \
  -d '{
    "idpName": "Test IdP",
    "entityId": "https://idp.example.com",
    "ssoUrl": "https://idp.example.com/saml/sso",
    "certificate": "INVALID CERTIFICATE"
  }'

echo -e "\n\n=== Testing POST /api/saml/config with INVALID ssoUrl (HTTP instead of HTTPS) ==="
curl -X POST http://localhost:3000/api/saml/config \
  -H "Content-Type: application/json" \
  -d '{
    "idpName": "Test IdP",
    "entityId": "https://idp.example.com",
    "ssoUrl": "http://idp.example.com/saml/sso",
    "certificate": "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAKL0UG+mRKJ7MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV\nBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX\naWRnaXRzIFB0eSBMdGQwHhcNMTkwMTAxMDAwMDAwWhcNMjkwMTAxMDAwMDAwWjBF\nMQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50\nZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\nCgKCAQEA1234567890\n-----END CERTIFICATE-----"
  }'

echo -e "\n\n=== Testing POST /api/saml/config with MISSING fields ==="
curl -X POST http://localhost:3000/api/saml/config \
  -H "Content-Type: application/json" \
  -d '{
    "idpName": "Test IdP"
  }'

echo -e "\n"
