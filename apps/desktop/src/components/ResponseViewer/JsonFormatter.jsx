import { useMemo } from 'react';
import { useUIStore } from '@/store/uiStore';

/**
 * Cross-platform JSON formatter that doesn't rely on Monaco Editor
 * Works reliably on Windows, Linux, macOS
 */
export default function JsonFormatter({ value, className = '' }) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  const formattedLines = useMemo(() => {
    if (!value) return [];
    
    // Split by newlines and format each line with syntax highlighting
    return value.split('\n').map((line, index) => ({
      lineNumber: index + 1,
      parts: parseLine(line, isDark)
    }));
  }, [value, isDark]);

  if (!value) {
    return <div className={`text-surface-400 text-sm ${className}`}>No response body</div>;
  }

  return (
    <div className={`font-mono text-xs overflow-auto h-full ${className}`}>
      <pre className="p-3 m-0" style={{ 
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        lineHeight: '1.5'
      }}>
        {formattedLines.map((line) => (
          <div key={line.lineNumber} className="table-row">
            {line.parts.map((part, i) => (
              <span key={i} style={{ color: part.color }}>
                {part.text}
              </span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}

/**
 * Parse a line of JSON and return colored segments
 */
function parseLine(line, isDark) {
  const colors = {
    key: isDark ? '#9cdcfe' : '#0451a5',      // Property names
    string: isDark ? '#ce9178' : '#a31515',   // String values
    number: isDark ? '#b5cea8' : '#098658',   // Numbers
    boolean: isDark ? '#569cd6' : '#0000ff',  // true/false
    null: isDark ? '#569cd6' : '#0000ff',     // null
    punctuation: isDark ? '#d4d4d4' : '#000000', // Brackets, braces, commas
    default: isDark ? '#d4d4d4' : '#000000'   // Default text
  };

  const parts = [];
  let remaining = line;
  let inString = false;
  let stringChar = '';
  let current = '';
  let isKey = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (!inString && (char === '"' || char === "'")) {
      if (current) {
        parts.push({ text: current, color: colors.default });
        current = '';
      }
      inString = true;
      stringChar = char;
      isKey = line.substring(i + 1).includes('":') || line.substring(i + 1).includes("':");
      current += char;
    } else if (inString && char === stringChar && line[i - 1] !== '\\') {
      current += char;
      parts.push({ 
        text: current, 
        color: isKey ? colors.key : colors.string 
      });
      current = '';
      inString = false;
    } else if (inString) {
      current += char;
    } else if (/[\{\}\[\],:]/.test(char)) {
      if (current.trim()) {
        const trimmed = current.trim();
        let color = colors.default;
        if (trimmed === 'true' || trimmed === 'false') color = colors.boolean;
        else if (trimmed === 'null') color = colors.null;
        else if (/^-?\d+(\.\d+)?$/.test(trimmed)) color = colors.number;
        parts.push({ text: current, color });
      }
      parts.push({ text: char, color: colors.punctuation });
      current = '';
    } else {
      current += char;
    }
  }

  if (current) {
    const trimmed = current.trim();
    let color = colors.default;
    if (trimmed === 'true' || trimmed === 'false') color = colors.boolean;
    else if (trimmed === 'null') color = colors.null;
    else if (/^-?\d+(\.\d+)?$/.test(trimmed)) color = colors.number;
    parts.push({ text: current, color });
  }

  return parts.length ? parts : [{ text: line, color: colors.default }];
}
