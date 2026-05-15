/** Toggle `//` line comments — shared by textarea and Monaco JSON body editor. */
export function toggleJsonLineComment(value, selStart, selEnd) {
  const lines = value.split('\n');
  const startIdx = value.slice(0, selStart).split('\n').length - 1;
  const endIdx = value.slice(0, selEnd).split('\n').length - 1;
  const block = lines.slice(startIdx, endIdx + 1);
  const allCommented = block.length > 0 && block.every((ln) => /^\s*\/\//.test(ln));
  const newBlock = block.map((ln) => {
    if (allCommented) return ln.replace(/^(\s*)\/\/\s?/, '$1');
    const m = /^(\s*)/.exec(ln);
    const ind = m ? m[1] : '';
    return `${ind}// ${ln.slice(ind.length)}`;
  });
  const newLines = [...lines.slice(0, startIdx), ...newBlock, ...lines.slice(endIdx + 1)];
  const newVal = newLines.join('\n');
  const offsetOfLine = (arr, idx) => {
    let o = 0;
    for (let i = 0; i < idx; i++) o += arr[i].length + 1;
    return o;
  };
  return {
    text: newVal,
    selStart: offsetOfLine(newLines, startIdx),
    selEnd: offsetOfLine(newLines, endIdx) + newLines[endIdx].length,
  };
}
