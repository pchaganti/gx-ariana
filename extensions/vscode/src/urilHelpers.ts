import { type Uri } from 'vscode';

export function formatUriForDB(uri: Uri): string {
    let uriPath = uri.fsPath;
    if (uriPath[1] === ':') {
        uriPath = uriPath[0].toUpperCase() + uriPath.slice(1);
    }
    return uriPath;
}
