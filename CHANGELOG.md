# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documentation audit and improvements
- Standardized server configuration naming
- Fixed tool numbering inconsistencies

### Changed
- Updated package.json postinstall script to use consistent server name
- Fixed duplicate tool numbering in README.md
- Corrected tool count from 11 to 12 tools

### Fixed
- Package name inconsistencies across documentation
- Server configuration naming inconsistencies
- Tool numbering errors in README.md

## [1.0.5] - 2024-01-23

### Added
- `createAndWait` tool for synchronous agent creation and polling
- `cancelCreateAndWait` tool for cooperative cancellation
- Comprehensive error handling and validation
- Production-ready deployment configuration
- Security documentation and best practices
- Extensive testing suite and examples

### Changed
- Standardized model default to 'auto' across all tools
- Enhanced API request/response logging with payload redaction
- Improved error messages and validation feedback

### Fixed
- `addFollowup` validation error where prompt data was validated against wrong schema
- HTTP 400 errors on createAndWait calls
- Schema validation inconsistencies

## [1.0.0] - 2024-01-15

### Added
- Initial release of Cursor Agent MCP Server
- 10 core MCP tools for agent management
- Claude Desktop integration support
- ChatGPT and OpenAI Platform integration
- Self-hosting capabilities with ngrok
- Comprehensive documentation and examples
- Production deployment guides
- Security best practices documentation

### Features
- Agent creation and management
- Repository and model discovery
- Conversation history access
- Webhook notifications
- Error handling and validation
- Health monitoring
- Token-based authentication