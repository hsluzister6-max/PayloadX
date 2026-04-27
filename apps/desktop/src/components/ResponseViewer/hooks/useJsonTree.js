import { useState, useMemo, useCallback } from 'react';

/**
 * Hook for managing JSON tree state and flattening
 * Handles virtualization-friendly data structure
 */
export function useJsonTree(jsonString, options = {}) {
  const { maxDepth = 100, defaultExpanded = false } = options;
  
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Parse JSON
  const parsedData = useMemo(() => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return null;
    }
  }, [jsonString]);

  // Flatten JSON into rows for virtualization
  const flattenedRows = useMemo(() => {
    if (!parsedData) return [];
    return flattenJson(parsedData, '', 0, expandedPaths, searchQuery, defaultExpanded);
  }, [parsedData, expandedPaths, searchQuery, defaultExpanded]);

  // Toggle expand/collapse
  const togglePath = useCallback((path) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Expand all
  const expandAll = useCallback(() => {
    if (!parsedData) return;
    const allPaths = collectPaths(parsedData, '');
    setExpandedPaths(new Set(allPaths));
  }, [parsedData]);

  // Collapse all
  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // Expand to specific depth
  const expandToDepth = useCallback((depth) => {
    if (!parsedData) return;
    const paths = collectPathsToDepth(parsedData, '', depth);
    setExpandedPaths(new Set(paths));
  }, [parsedData]);

  return {
    rows: flattenedRows,
    expandedPaths,
    searchQuery,
    setSearchQuery,
    togglePath,
    expandAll,
    collapseAll,
    expandToDepth,
    isValid: !!parsedData,
    totalRows: flattenedRows.length
  };
}

/**
 * Flatten JSON structure into array of row objects
 */
function flattenJson(obj, path = '', depth = 0, expandedPaths, searchQuery, defaultExpanded, isLast = true) {
  const rows = [];
  const matchesSearch = searchQuery ? path.toLowerCase().includes(searchQuery.toLowerCase()) : true;
  
  if (depth > 100) {
    return [{ type: 'max-depth', path, depth, value: '[Max depth reached]' }];
  }

  if (Array.isArray(obj)) {
    const isExpanded = defaultExpanded || expandedPaths.has(path) || matchesSearch;
    const isEmpty = obj.length === 0;
    
    rows.push({
      type: 'array',
      path,
      depth,
      isExpanded,
      isEmpty,
      length: obj.length,
      isLast,
      matchesSearch
    });
    
    if (isExpanded && !isEmpty) {
      obj.forEach((item, i) => {
        const itemPath = `${path}[${i}]`;
        const itemIsLast = i === obj.length - 1;
        
        if (typeof item === 'object' && item !== null) {
          rows.push(...flattenJson(item, itemPath, depth + 1, expandedPaths, searchQuery, defaultExpanded, itemIsLast));
        } else {
          rows.push({
            type: 'value',
            path: itemPath,
            depth: depth + 1,
            key: i,
            value: item,
            valueType: getValueType(item),
            isLast: itemIsLast,
            matchesSearch: searchQuery ? String(item).toLowerCase().includes(searchQuery.toLowerCase()) : true
          });
        }
      });
    }
  } else if (typeof obj === 'object' && obj !== null) {
    const isExpanded = defaultExpanded || expandedPaths.has(path) || matchesSearch;
    const keys = Object.keys(obj);
    const isEmpty = keys.length === 0;
    
    rows.push({
      type: 'object',
      path,
      depth,
      isExpanded,
      isEmpty,
      keyCount: keys.length,
      isLast,
      matchesSearch
    });
    
    if (isExpanded && !isEmpty) {
      keys.forEach((key, i) => {
        const value = obj[key];
        const valuePath = path ? `${path}.${key}` : key;
        const valueIsLast = i === keys.length - 1;
        const keyMatchesSearch = searchQuery ? key.toLowerCase().includes(searchQuery.toLowerCase()) : true;
        
        if (typeof value === 'object' && value !== null) {
          rows.push(...flattenJson(value, valuePath, depth + 1, expandedPaths, searchQuery, defaultExpanded, valueIsLast));
        } else {
          const valueMatchesSearch = searchQuery ? String(value).toLowerCase().includes(searchQuery.toLowerCase()) : true;
          rows.push({
            type: 'value',
            path: valuePath,
            depth: depth + 1,
            key,
            value,
            valueType: getValueType(value),
            isLast: valueIsLast,
            matchesSearch: keyMatchesSearch || valueMatchesSearch
          });
        }
      });
    }
  } else {
    // Primitive value at root
    rows.push({
      type: 'value',
      path,
      depth,
      value: obj,
      valueType: getValueType(obj),
      isLast,
      matchesSearch
    });
  }
  
  return rows;
}

/**
 * Get value type for syntax highlighting
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return typeof value;
}

/**
 * Collect all paths in JSON (for expand all)
 */
function collectPaths(obj, path = '') {
  const paths = [path];
  
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      const itemPath = `${path}[${i}]`;
      paths.push(itemPath);
      if (typeof item === 'object' && item !== null) {
        paths.push(...collectPaths(item, itemPath));
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      const valuePath = path ? `${path}.${key}` : key;
      paths.push(valuePath);
      if (typeof value === 'object' && value !== null) {
        paths.push(...collectPaths(value, valuePath));
      }
    });
  }
  
  return paths;
}

/**
 * Collect paths up to specific depth
 */
function collectPathsToDepth(obj, path = '', maxDepth) {
  const paths = [];
  
  function recurse(current, currentPath, depth) {
    if (depth >= maxDepth) return;
    
    paths.push(currentPath);
    
    if (Array.isArray(current)) {
      current.forEach((item, i) => {
        const itemPath = `${currentPath}[${i}]`;
        if (typeof item === 'object' && item !== null) {
          recurse(item, itemPath, depth + 1);
        }
      });
    } else if (typeof current === 'object' && current !== null) {
      Object.keys(current).forEach((key) => {
        const value = current[key];
        const valuePath = currentPath ? `${currentPath}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          recurse(value, valuePath, depth + 1);
        }
      });
    }
  }
  
  recurse(obj, path, 0);
  return paths;
}
