/* Runs only after the user clicks Open page in Skim. Returns bounded plain text. */
(() => {
  'use strict';
  const LIMIT = 24000;
  const excluded = 'script,style,noscript,template,svg,canvas,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"]';
  const cache = new WeakMap();
  let budget = 18000;
  function readable(element) {
    if (!(element instanceof Element) || element.closest(excluded)) return false;
    if (cache.has(element)) return cache.get(element);
    let visible = element.getClientRects().length > 0;
    for (let el = element; visible && el; el = el.parentElement) {
      const style = getComputedStyle(el);
      visible = style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && Number(style.opacity) !== 0;
    }
    cache.set(element, visible);
    return visible;
  }
  function textOf(root, selectedRange) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const parts = [];
    let node, length = 0, lastBlock = null;
    while (budget > 0 && length < LIMIT && (node = walker.nextNode())) {
      budget--;
      const parent = node.parentElement;
      if (!readable(parent) || (selectedRange && !selectedRange.intersectsNode(node))) continue;
      const start = selectedRange && node === selectedRange.startContainer ? selectedRange.startOffset : 0;
      const end = selectedRange && node === selectedRange.endContainer ? selectedRange.endOffset : node.nodeValue.length;
      const value = node.nodeValue.slice(start, end);
      const block = parent.closest('p,li,blockquote,h1,h2,h3,h4,h5,h6,pre,div,section');
      if (block && lastBlock && block !== lastBlock) parts.push('\n\n');
      // Keep whitespace-only nodes: they can be the only space between inline elements.
      parts.push(value);
      length += value.length;
      lastBlock = block;
    }
    return parts.join('').replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, LIMIT);
  }
  const selection = window.getSelection();
  let text = '', kind = 'page';
  if (selection && !selection.isCollapsed && selection.rangeCount) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!readable(container) || selection.anchorNode?.parentElement?.closest(excluded) || selection.focusNode?.parentElement?.closest(excluded)) {
      return {error: 'Select text in the page, outside an input or editable field.'};
    }
    text = textOf(container, range);
    if (!text) return {error: 'The selection contains no readable page text.'};
    kind = 'selection';
  }
  if (!text) {
    const answers = [...document.querySelectorAll('[data-message-author-role="assistant"]')].filter(readable);
    const root = answers.at(-1) || [...document.querySelectorAll('article,main,[role="main"]')].find(readable);
    if (root) {
      text = textOf(root);
      kind = answers.length ? 'latest assistant response' : 'article';
    } else {
      const parts = [];
      let length = 0;
      for (const paragraph of document.querySelectorAll('p,blockquote')) {
        if (length >= LIMIT || budget <= 0) break;
        if (!readable(paragraph) || paragraph.closest('nav,header,footer,aside')) continue;
        if (paragraph.tagName === 'P' && paragraph.closest('blockquote')) continue;
        const part = textOf(paragraph);
        parts.push(part);
        length += part.length + 2;
      }
      text = parts.join('\n\n').slice(0, LIMIT);
    }
  }
  return {text, title: (document.title || 'This page').slice(0, 180), kind};
})()
