import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TextSearchService {
  /**
   * Filters an array of objects by a text search term.
   * Search is case-insensitive and checks if the term is contained in any of the values.
   *
   * @param items - The array to search within
   * @param term - The search term (trimmed and case-insensitive)
   * @param getSearchableValues - For each item, returns the string values to search in (e.g. title, description, tags)
   * @returns The filtered array. Empty or whitespace-only term returns all items unchanged.
   */
  search<T>(
    items: T[],
    term: string,
    getSearchableValues: (item: T) => string[]
  ): T[] {
    const normalized = term.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const haystacks = getSearchableValues(item).map((value) =>
        (value ?? '').toLowerCase()
      );
      return haystacks.some((value) => value.includes(normalized));
    });
  }

  /**
   * Returns whether the given term represents an active search (non-empty after trim).
   */
  hasActiveSearch(term: string): boolean {
    return term.trim().length > 0;
  }
}
