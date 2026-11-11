// localStorage can be unavailable (private mode, blocked site data). Reads then
// fall back to the default and writes only last for the session.

export function readStorage(key, fallback) {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // see module comment
    }
}
