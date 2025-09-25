import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Detects if there are any code changes in the current repository
 * @param {string} repository - The repository URL or path
 * @returns {Promise<boolean>} - True if there are code changes, false otherwise
 */
export async function hasCodeChanges(repository) {
  try {
    // Extract repository path from URL if it's a GitHub URL
    if (repository.startsWith('https://github.com/')) {
      // For GitHub URLs, we can't directly check the remote repo
      // Instead, we'll assume there might be changes if it's a development scenario
      // In a real implementation, you might want to clone the repo temporarily
      return true; // Default to true for GitHub URLs to be safe
    }

    // For local repositories, check git status
    if (repository.startsWith('/') || repository.startsWith('./') || repository.startsWith('../')) {
      try {
        const { stdout } = await execAsync('git status --porcelain', { cwd: repository });
        return stdout.trim().length > 0;
      } catch (error) {
        console.warn('Could not check git status:', error.message);
        return true; // Default to true if we can't determine
      }
    }

    // For other cases, default to true to be safe
    return true;
  } catch (error) {
    console.warn('Error detecting code changes:', error.message);
    return true; // Default to true to be safe
  }
}

/**
 * Gets the current git branch name
 * @param {string} repository - The repository path
 * @returns {Promise<string|null>} - The current branch name or null if not available
 */
export async function getCurrentBranch(repository) {
  try {
    if (repository.startsWith('https://github.com/')) {
      return null; // Can't determine branch for remote URLs
    }

    const { stdout } = await execAsync('git branch --show-current', { cwd: repository });
    return stdout.trim() || null;
  } catch (error) {
    console.warn('Could not get current branch:', error.message);
    return null;
  }
}

/**
 * Checks if the repository has uncommitted changes
 * @param {string} repository - The repository path
 * @returns {Promise<boolean>} - True if there are uncommitted changes
 */
export async function hasUncommittedChanges(repository) {
  try {
    if (repository.startsWith('https://github.com/')) {
      return false; // Can't check remote repositories
    }

    const { stdout } = await execAsync('git diff --name-only', { cwd: repository });
    return stdout.trim().length > 0;
  } catch (error) {
    console.warn('Could not check for uncommitted changes:', error.message);
    return false;
  }
}