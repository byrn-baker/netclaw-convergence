import createDOMPurify from 'dompurify';

// Local templates include untrusted peer/tool metadata. Preserve UI markup,
// without granting that metadata script or embedded-resource access.
const purifiers = new WeakMap();
const safeStyleProperties = new Set([
  'color', 'background', 'background-color', 'border-color', 'border', 'border-top',
  'border-bottom', 'border-radius', 'font-size', 'font-weight', 'font-family',
  'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform',
  'text-decoration', 'white-space', 'word-break', 'opacity', 'display', 'gap',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'align-items', 'justify-content', 'flex', 'flex-direction', 'overflow',
]);

function purifierFor(element) {
  const win = element.ownerDocument.defaultView;
  let purifier = purifiers.get(win);
  if (!purifier) {
    purifier = createDOMPurify(win);
    purifier.addHook('uponSanitizeAttribute', (_node, attribute) => {
      if (attribute.attrName !== 'style') return;
      const style = win.document.createElement('span').style;
      style.cssText = attribute.attrValue;
      const allowed = [];
      for (let i = 0; i < style.length; i += 1) {
        const property = style[i];
        const value = style.getPropertyValue(property);
        if (safeStyleProperties.has(property)
          && /^[a-zA-Z0-9#%., ()_-]+$/.test(value)
          && !/(?:url|image|expression|attr|var)\s*\(/i.test(value)) {
          allowed.push(`${property}:${value}`);
        }
      }
      attribute.attrValue = allowed.join(';');
      attribute.keepAttr = allowed.length > 0;
    });
    purifiers.set(win, purifier);
  }
  return purifier;
}

function cleanFragment(element, html) {
  return purifierFor(element).sanitize(String(html ?? ''), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'link', 'img', 'video', 'audio', 'source', 'form',
      'iframe', 'object', 'embed', 'svg', 'math', 'template', 'base', 'meta'],
    FORBID_ATTR: ['src', 'srcset', 'background', 'poster', 'action', 'formaction',
      'autofocus', 'srcdoc', 'ping'],
    RETURN_DOM_FRAGMENT: true,
  });
}

export function setSafeHtml(element, html) {
  element.replaceChildren(cleanFragment(element, html));
}

export function appendSafeHtml(element, html) {
  element.append(cleanFragment(element, html));
}
