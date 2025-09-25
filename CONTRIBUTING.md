# Contributing to Cursor MCP Server

Thank you for your interest in contributing to the Cursor MCP Server! This document provides guidelines and information for contributors.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/cursor-agent-mcp.git
   cd cursor-agent-mcp
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🛠️ Development Setup

### Prerequisites
- **Node.js** 18+ 
- **npm** (comes with Node.js)
- **Git**

### Environment Configuration
1. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```
2. **Add your Cursor API key** to `.env`:
   ```env
   CURSOR_API_KEY=your_cursor_api_key_here
   PORT=3000
   ```

### Available Scripts
```bash
# Development
npm run dev           # Start with auto-reload
npm start            # Start production server
npm run mcp          # Start MCP server only
npm run cli          # Run CLI interface

# Testing & Quality
npm test             # Run test suite
npm run lint         # Fix linting issues
npm run lint:check   # Check linting without fixing

# Testing Tools
node test-mcp-client.js        # Test MCP client integration
node test-error-handling.js    # Test error handling
bash test-curl-examples.sh     # Test with curl
```

## 📋 Development Workflow

### 1. Branch Protection Rules
This repository uses **branch protection** to ensure code quality:
- ✅ **All changes must go through Pull Requests**
- ✅ **Tests must pass** before merging
- ✅ **Linting must pass** before merging
- ✅ **Status checks must be green**

### 2. Making Changes
1. **Create a feature branch** from `main`
2. **Make your changes** following the coding standards below
3. **Test your changes** locally:
   ```bash
   npm test
   npm run lint:check
   ```
4. **Commit your changes** with clear commit messages
5. **Push your branch** and create a Pull Request

### 3. Pull Request Process
1. **Create a Pull Request** with a clear title and description
2. **Wait for CI checks** to pass (tests, linting)
3. **Address any feedback** from maintainers
4. **Maintainers will review and merge** your changes

## 📝 Coding Standards

### Code Style
- **ES Modules**: Use ES modules (`import`/`export`)
- **Node.js 18+**: Target Node.js 18.0.0 or higher
- **Indentation**: Use 2 spaces (not tabs)
- **Quotes**: Use single quotes (`'`) for strings
- **Trailing Commas**: Use trailing commas where appropriate
- **Naming**: Use `camelCase` for variables/functions, `PascalCase` for classes

### File Organization
- **One component per file**: Keep files focused and modular
- **Clear separation**: Separate concerns (config, utils, tools, etc.)
- **Header comments**: Each file should have a header comment explaining its purpose
- **JSDoc**: Document all public functions with JSDoc comments

### Example Code Structure
```javascript
/**
 * @fileoverview Description of what this file does
 */

import { someUtil } from './utils/someUtil.js';

/**
 * Description of the function
 * @param {string} param1 - Description of parameter
 * @param {Object} param2 - Description of parameter
 * @returns {Promise<Object>} Description of return value
 */
export async function exampleFunction(param1, param2) {
  // Implementation here
}
```

## 🧪 Testing Guidelines

### Writing Tests
- **Test files**: Use `*.test.js` naming convention
- **Jest framework**: Use Jest for testing (already configured)
- **Mock external APIs**: Mock Cursor API calls for deterministic tests
- **Test coverage**: Aim for good test coverage of new functionality

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { someFunction } from '../src/utils/someFunction.js';

describe('someFunction', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something specific', async () => {
    const result = await someFunction('test');
    expect(result).toBe('expected');
  });
});
```

## 🔍 Code Quality

### ESLint Configuration
The project uses ESLint for code quality. Run these commands:
```bash
npm run lint         # Fix auto-fixable issues
npm run lint:check   # Check for issues without fixing
```

### Pre-commit Checks
Before committing, ensure:
- ✅ All tests pass (`npm test`)
- ✅ Linting passes (`npm run lint:check`)
- ✅ No console.log statements in production code
- ✅ Environment variables are properly handled

## 📚 Documentation

### Code Documentation
- **JSDoc comments**: Document all public functions
- **Type definitions**: Use JSDoc types for parameters and returns
- **Inline comments**: Explain complex logic
- **README updates**: Update README.md for user-facing changes

### API Documentation
- **Tool descriptions**: Update tool descriptions in `src/tools/index.js`
- **Example usage**: Provide examples for new features
- **Error handling**: Document error cases and responses

## 🐛 Bug Reports

### Before Reporting
1. **Check existing issues** to avoid duplicates
2. **Test with latest version** to ensure it's not already fixed
3. **Gather information** about your environment and setup

### Bug Report Template
```markdown
**Bug Description**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior**
What you expected to happen.

**Environment**
- Node.js version: [e.g. 18.17.0]
- npm version: [e.g. 9.6.7]
- OS: [e.g. macOS, Windows, Linux]

**Additional Context**
Any other context about the problem.
```

## ✨ Feature Requests

### Before Requesting
1. **Check existing issues** for similar requests
2. **Consider the scope** - is this a good fit for the project?
3. **Think about implementation** - how might this be implemented?

### Feature Request Template
```markdown
**Feature Description**
A clear description of the feature you'd like to see.

**Use Case**
Describe the problem this would solve or the workflow it would improve.

**Proposed Solution**
Describe how you think this should work.

**Alternatives**
Describe any alternative solutions you've considered.

**Additional Context**
Any other context about the feature request.
```

## 🔧 Development Tools

### Recommended VS Code Extensions
- **ESLint**: For code linting
- **Prettier**: For code formatting
- **Jest**: For test running
- **Node.js Extension Pack**: For Node.js development

### Debugging
- **Console logging**: Use `console.log` for debugging (remove before committing)
- **Node.js debugger**: Use `--inspect` flag for debugging
- **Test debugging**: Use `npm test -- --detectOpenHandles` for async issues

## 📋 Pull Request Guidelines

### PR Title Format
Use clear, descriptive titles:
- ✅ `Add support for custom webhook URLs`
- ✅ `Fix authentication error handling`
- ✅ `Update documentation for new API endpoints`
- ❌ `Fix bug`
- ❌ `Update stuff`

### PR Description Template
```markdown
## Description
Brief description of what this PR does.

## Changes
- List of specific changes made
- Any new features added
- Any bugs fixed

## Testing
- [ ] Tests pass locally
- [ ] Linting passes
- [ ] Manual testing completed
- [ ] No breaking changes (or clearly documented)

## Screenshots/Logs
If applicable, add screenshots or log outputs.

## Related Issues
Closes #123
```

### Review Process
1. **Automated checks** must pass (tests, linting)
2. **Code review** by maintainers
3. **Address feedback** promptly
4. **Squash commits** if requested
5. **Merge** after approval

## 🏷️ Release Process

### Version Bumping
- **Patch** (1.0.1): Bug fixes, documentation updates
- **Minor** (1.1.0): New features, new tools, non-breaking changes
- **Major** (2.0.0): Breaking changes, major refactoring

### Release Checklist
- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` (if applicable)
- [ ] Update documentation
- [ ] Run full test suite
- [ ] Create release tag
- [ ] Publish to npm

## 🤝 Community Guidelines

### Code of Conduct
- **Be respectful** and inclusive
- **Be constructive** in feedback
- **Be patient** with questions
- **Be helpful** to other contributors

### Getting Help
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Requests**: For code contributions

## 📞 Contact

- **Maintainer**: Griffin Long (@griffinwork40)
- **Repository**: https://github.com/griffinwork40/cursor-agent-mcp
- **Issues**: https://github.com/griffinwork40/cursor-agent-mcp/issues

## 🙏 Recognition

Contributors will be recognized in:
- **README.md** contributors section
- **Release notes** for significant contributions
- **GitHub contributors** page

Thank you for contributing to the Cursor MCP Server! 🚀
