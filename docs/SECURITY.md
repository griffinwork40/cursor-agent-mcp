# Security Documentation

## Overview

This document outlines the security model, best practices, and configuration recommendations for the Cursor Agent MCP Server.

## Authentication Model

### API Key Authentication

The server uses **Bearer token authentication** with Cursor API keys:

- **Key Format**: Keys start with `key_` prefix
- **Key Scope**: Full account access (read/write to repositories, create/manage agents)
- **Key Storage**: Environment variables or secure configuration
- **Key Rotation**: Supported via Cursor dashboard

### Environment Configuration

**Required Environment Variables:**
```bash
CURSOR_API_KEY=your_cursor_api_key_here
```

**Optional Security Variables:**
```bash
TOKEN_SECRET=your_random_secret_here  # For token-based authentication
PORT=3000                            # Server port
CURSOR_API_URL=https://api.cursor.com # API endpoint
```

## Authorization and Access Control

### Principle of Least Privilege

The MCP server requires **full account access** due to the nature of background agent operations:

- **Repository Access**: Read/write access to all repositories
- **Agent Management**: Create, modify, and delete agents
- **API Key Information**: Access to account details

### User Permissions

The server operates with the permissions of the provided API key:

- **Repository Scope**: Can access any repository the API key has access to
- **Agent Limits**: Subject to the account's agent creation limits
- **Rate Limits**: Inherits the account's rate limiting

## Webhook Security

### Webhook Configuration

When configuring webhooks for agent notifications:

```json
{
  "webhook": {
    "url": "https://your-domain.com/webhook",
    "secret": "your_webhook_secret_here"
  }
}
```

### Webhook Security Requirements

1. **HTTPS Required**: All webhook URLs must use HTTPS
2. **Secret Verification**: Provide a secret for payload verification
3. **URL Validation**: Webhook URLs are validated for proper format
4. **Secret Length**: Minimum 32 characters, maximum 256 characters

### Webhook Payload Verification

The server expects webhook secrets to be used for HMAC verification of incoming payloads. Implement verification in your webhook handler:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

## Secret Management

### API Key Security

#### ✅ **Do:**
- Store API keys in environment variables
- Use separate keys for different environments
- Rotate keys regularly (every 90 days recommended)
- Monitor key usage in Cursor dashboard
- Use dedicated service accounts when possible

#### ❌ **Don't:**
- Commit API keys to version control
- Share keys across different services
- Use personal API keys for production
- Store keys in configuration files

### Token Security

For deployments requiring token-based authentication:

```bash
# Generate a secure random secret
openssl rand -hex 32

# Set as environment variable
TOKEN_SECRET=your_generated_secret_here
```

**Token Security Features:**
- **TTL Support**: Configurable token expiration (default: 30 days)
- **Process Isolation**: Tokens are scoped to server instances
- **Secure Generation**: Use cryptographically secure random generation

## Dependency and Supply Chain Security

### Package Security

The server uses minimal, well-maintained dependencies:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.18.1",
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4"
  }
}
```

### Security Measures

#### Dependency Updates
- **Automated Updates**: Use `npm audit` and `npm update` regularly
- **Vulnerability Scanning**: Regular security scans with tools like `npm audit`
- **Minimal Dependencies**: Only essential packages included

#### Code Security
- **Input Validation**: All inputs validated using Zod schemas
- **Error Handling**: Secure error responses without information leakage
- **HTTPS Enforcement**: Production deployments should use HTTPS
- **CORS Policy**: Minimal CORS configuration for security

## Secure Configuration

### Production Deployment

#### Environment Variables
```bash
# Required
CURSOR_API_KEY=your_production_api_key
NODE_ENV=production

# Optional Security
TOKEN_SECRET=your_secure_random_secret
PORT=3000
CURSOR_API_URL=https://api.cursor.com

# Security Headers (if using reverse proxy)
# Add appropriate security headers in your reverse proxy
```

#### Docker Security
```dockerfile
# Use official Node.js base image
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies as root (required for npm install)
RUN npm ci --only=production

# Change ownership to non-root user
RUN chown -R mcpuser:nodejs /app
USER mcpuser

# Copy source code
COPY --chown=mcpuser:nodejs src/ ./src/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]
```

### Network Security

#### Firewall Configuration
```bash
# Allow only necessary ports
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT   # If using HTTP
iptables -A INPUT -p tcp --dport 443 -j ACCEPT  # If using HTTPS
iptables -A INPUT -j DROP
```

#### Reverse Proxy Security
```nginx
# Nginx configuration example
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Proxy to MCP server
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Logging

### Security Monitoring

#### Log Security
- **Request Logging**: All requests logged with IP and timestamp
- **Error Logging**: Detailed error logs with context
- **No Sensitive Data**: API keys and secrets never logged

#### Monitoring Recommendations
- **Health Checks**: Use `/health` endpoint for monitoring
- **Metric Collection**: Monitor request rates and error rates
- **Alerting**: Set up alerts for unusual patterns

### Incident Response

#### Security Incidents
1. **Detection**: Monitor logs for suspicious patterns
2. **Response**: Rotate affected API keys immediately
3. **Investigation**: Review access logs and timestamps
4. **Recovery**: Clean up any unauthorized agents or changes

#### Breach Response
```bash
# Rotate API key immediately
curl -X POST https://api.cursor.com/v0/api-keys \
  -H "Authorization: Bearer $CURRENT_API_KEY" \
  -d '{"name": "Rotated Key", "permissions": "full"}'

# Delete suspicious agents
curl -X DELETE https://api.cursor.com/v0/agents/$AGENT_ID \
  -H "Authorization: Bearer $NEW_API_KEY"
```

## Responsible Disclosure

### Reporting Security Issues

If you discover a security vulnerability, please follow responsible disclosure practices:

1. **Do not** exploit the vulnerability
2. **Do not** publish details publicly
3. **Report** to the maintainers via:
   - GitHub Security Advisory (preferred)
   - Email: security@cursor.com
   - Issue: https://github.com/griffinwork40/cursor-agent-mcp/issues

### Vulnerability Response

**Response Timeline:**
- **Acknowledgment**: Within 24 hours
- **Investigation**: Within 72 hours
- **Fix**: Within 7-14 days (depending on severity)
- **Public Disclosure**: After fix is deployed

**Severity Levels:**
- **Critical**: Immediate response required
- **High**: Response within 24 hours
- **Medium**: Response within 72 hours
- **Low**: Response within 1 week

## Compliance Considerations

### Data Protection

#### PII Handling
- **No PII Storage**: Server does not store personal data
- **Transient Processing**: Data processed in memory only
- **Secure Transmission**: All data transmitted over HTTPS

#### GDPR Considerations
- **Data Minimization**: Only necessary data processed
- **Purpose Limitation**: Data used only for agent operations
- **Storage Limitation**: No persistent storage of user data

### Audit Requirements

#### Logging for Compliance
```javascript
// Example compliance logging
const logSecurityEvent = (event, details) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    details,
    // Never log sensitive data like API keys
  };

  // Send to your compliance logging system
  complianceLogger.info(logEntry);
};
```

## Best Practices Checklist

### ✅ **Development Environment**
- [ ] Use environment-specific API keys
- [ ] Store secrets in environment variables
- [ ] Enable debug logging only in development
- [ ] Use HTTPS for all webhook URLs

### ✅ **Production Environment**
- [ ] Use dedicated service account API keys
- [ ] Rotate API keys every 90 days
- [ ] Monitor API key usage
- [ ] Enable security headers
- [ ] Use HTTPS with valid certificates
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerting
- [ ] Regular security audits

### ✅ **Incident Response**
- [ ] Document incident response procedures
- [ ] Have API key rotation process ready
- [ ] Monitor for suspicious activity
- [ ] Regular backup of configurations
- [ ] Test incident response procedures

### ✅ **Compliance**
- [ ] Document data processing activities
- [ ] Implement data retention policies
- [ ] Regular security assessments
- [ ] Staff training on security practices

## Support

For security-related questions or concerns:

- **GitHub Issues**: https://github.com/griffinwork40/cursor-agent-mcp/issues
- **Security Email**: security@cursor.com
- **Documentation**: https://github.com/griffinwork40/cursor-agent-mcp#readme

---

**Last Updated**: $(date)
**Version**: 1.0.5