const TOKEN_SPLIT_PATTERN = /[^a-z0-9]+/g;

export function normalizeName(value: string | null | undefined): string {
    if (!value) {
        return "";
    }
    return stripAccents(value.toLowerCase()).replace(/[^a-z0-9]+/g, "");
}

export function tokenizeName(value: string | null | undefined): string[] {
    if (!value) {
        return [];
    }
    const normalized = stripAccents(value.toLowerCase()).replace(TOKEN_SPLIT_PATTERN, " ");
    return normalized
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}

export function stripAccents(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export { TOKEN_SPLIT_PATTERN };

