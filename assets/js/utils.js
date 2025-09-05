/**
 * Selects a single element from the DOM.
 * @param {string} selector - The CSS selector.
 * @returns {HTMLElement}
 */
const $ = (selector) => document.querySelector(selector);

/**
 * Selects multiple elements from the DOM.
 * @param {string} selector - The CSS selector.
 * @returns {NodeListOf<HTMLElement>}
 */
const $$ = (selector) => document.querySelectorAll(selector);

/**
 * Formats time in seconds to a MM:SS string.
 * @param {number} seconds - The time in seconds.
 * @returns {string}
 */
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * Logs a message to the activity log in the UI.
 * @param {string} message - The message to log.
 * @param {string} type - 'info', 'success', 'error', 'warning'.
 */
function logActivity(message, type = 'info') {
    const logContainer = $('#log-container');
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="timestamp">[${timestamp}]</span> <span class="message">${message}</span>`;
    logContainer.prepend(entry);
}