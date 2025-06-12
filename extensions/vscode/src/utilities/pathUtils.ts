/**
 * Normalizes a file path by replacing backslashes with forward slashes.
 * This is a simple string replacement suitable for the webview environment.
 * @param filePath The path to normalize.
 * @returns The normalized path with forward slashes.
 */
export function normalizeSlashesWeb(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Truncates the beginning of a file path if it matches one of the provided root paths.
 * Normalizes paths to use forward slashes for comparison and output.
 *
 * @param absolutePath The absolute file path to truncate.
 * @param rootPaths An array of absolute root paths (expected to be normalized with forward slashes or will be normalized).
 * @returns The truncated path relative to the matching root, or the original path if no root matches.
 */
export function getRelativePath(
    absolutePath: string,
    rootPaths: string[]
): string {
    console.log("getRelativePath", absolutePath, rootPaths);
    
    if (!absolutePath || !rootPaths || rootPaths.length === 0) {
        return absolutePath;
    }

    const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/');

    // Normalize roots and sort by length descending to handle nested roots correctly
    const sortedRoots = [...rootPaths]
        .map(r => r.replace(/\\/g, '/')) 
        .sort((a, b) => b.length - a.length);

    for (let root of sortedRoots) {
        // For comparison, ensure root doesn't have a trailing slash unless it's just "/"
        const comparisonRoot = (root.endsWith('/') && root.length > 1) ? root.slice(0, -1) : root;

        if (normalizedAbsolutePath.startsWith(comparisonRoot)) {
            if (normalizedAbsolutePath.length === comparisonRoot.length) {
                // Path is identical to the root. Return the last component of the root.
                const parts = comparisonRoot.split('/');
                return parts[parts.length - 1] || (comparisonRoot === '/' ? '/' : '.');
            }

            // Check if it's a subpath.
            if (comparisonRoot === '/') {
                // Root is '/', path is '/file.txt'. Relative is 'file.txt'
                return normalizedAbsolutePath.substring(1);
            } else if (normalizedAbsolutePath.charAt(comparisonRoot.length) === '/') {
                // Root is '/foo', path is '/foo/bar.txt'. Relative is 'bar.txt'
                return normalizedAbsolutePath.substring(comparisonRoot.length + 1);
            }
            // If not identical and not a subpath with a separator (e.g. root "/foo", path "/foobar"),
            // it's not a match for this root; continue to the next root.
        }
    }

    return absolutePath; // No matching root found
}
