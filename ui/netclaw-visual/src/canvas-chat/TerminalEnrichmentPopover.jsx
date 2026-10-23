import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { calculateEnrichmentDock, calculateEnrichmentPopoverPlacement } from "./enrichment-layout.js";
import "./TerminalEnrichmentPopover.css";
import TopologyImage from './TopologyImage.jsx';

const HOVER_CLOSE_DELAY = 250;

const objectKey = (data) => data?.key ?? data?.value;

export { calculateEnrichmentPopoverPlacement } from "./enrichment-layout.js";

// Portals bypass ancestor overflow, so explicitly intersect the terminal with
// its clipping containers (including a scrolled/zoomed canvas) before placing it.
function visibleTerminalRegion(element) {
  if (!visibleAnchor(element)) return null;
  const rect = element.getBoundingClientRect();
  const region = { left: Math.max(0, rect.left), top: Math.max(0, rect.top),
    right: Math.min(window.innerWidth, rect.right), bottom: Math.min(window.innerHeight, rect.bottom) };
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = window.getComputedStyle(parent);
    const clip = parent.getBoundingClientRect();
    const scaleX = parent.offsetWidth ? clip.width / parent.offsetWidth : 1;
    const scaleY = parent.offsetHeight ? clip.height / parent.offsetHeight : 1;
    const left = clip.left + parent.clientLeft * scaleX;
    const top = clip.top + parent.clientTop * scaleY;
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
      region.left = Math.max(region.left, left);
      region.right = Math.min(region.right, left + parent.clientWidth * scaleX);
    }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
      region.top = Math.max(region.top, top);
      region.bottom = Math.min(region.bottom, top + parent.clientHeight * scaleY);
    }
  }
  return region.right - region.left > 24 && region.bottom - region.top > 24 ? region : null;
}

function visibleAnchor(element) {
  if (!element?.isConnected || !element.getClientRects().length) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return null;
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor);
    if (style.display === "none" || style.visibility === "hidden") return null;
    if (ancestor === element) continue;
    const clip = ancestor.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY) && (rect.bottom <= clip.top || rect.top >= clip.bottom)) return null;
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX) && (rect.right <= clip.left || rect.left >= clip.right)) return null;
  }
  return rect;
}

/** Shared interaction state for real terminal decorations and the synthetic demo. */
export function useTerminalEnrichmentHover() {
  const [card, setCard] = useState(null);
  const cardRef = useRef(null);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const closeTimerRef = useRef(null);
  const hoveringPanelRef = useRef(false);

  const cancelClose = useCallback(() => {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const close = useCallback((restoreFocus = true) => {
    cancelClose();
    if (restoreFocus && panelRef.current?.contains(document.activeElement)) {
      anchorRef.current?.focus?.({ preventScroll: true });
    }
    cardRef.current = null;
    anchorRef.current = null;
    hoveringPanelRef.current = false;
    setCard(null);
  }, [cancelClose]);

  const open = useCallback((data, element, { pin = false } = {}) => {
    if (!element?.isConnected) return;
    cancelClose();
    const previous = cardRef.current;
    if (previous?.pinned && !pin) {
      // A refresh of the same object may enrich its fields, but hovering a
      // different route must never replace the card the operator pinned.
      if (objectKey(previous.data) != null && objectKey(previous.data) === objectKey(data)) {
        const updated = { data, pinned: true };
        cardRef.current = updated;
        setCard(updated);
      }
      return;
    }
    const next = { data, pinned: pin };
    anchorRef.current = element;
    cardRef.current = next;
    setCard(next);
  }, [cancelClose]);

  const pin = useCallback(() => {
    cancelClose();
    if (!cardRef.current) return;
    const next = { ...cardRef.current, pinned: !cardRef.current.pinned };
    cardRef.current = next;
    setCard(next);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      // The dock can be far from its route. Keep it available while crossing
      // the terminal; another hover, outside click, Escape or Close updates it.
      if (panelRef.current?.dataset.placement === "docked") return;
      if (cardRef.current?.pinned || hoveringPanelRef.current || panelRef.current?.contains(document.activeElement)) return;
      close(false);
    }, HOVER_CLOSE_DELAY);
  }, [cancelClose, close]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    if (!card) return undefined;
    const onPointerDown = (event) => {
      if (event.target.closest?.('[data-topology-image-viewer]')) return;
      const resizing = event.target.closest?.("[data-terminal-resize]");
      if (resizing && resizing.closest(".lane-in") === anchorRef.current?.closest(".lane-in")) return;
      if (!panelRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) close(false);
    };
    const onKeyDown = (event) => {
      if (document.querySelector('[data-topology-image-viewer]')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        // The portal is at the end of body. Move naturally from a focused route
        // into its card instead of making keyboard users traverse the canvas.
        const firstControl = panelRef.current?.querySelector("button:not(:disabled), input:not(:disabled), [tabindex='0']");
        if (!event.shiftKey && anchorRef.current === document.activeElement && firstControl) {
          event.preventDefault();
          firstControl.focus();
        } else if (event.shiftKey && document.activeElement === firstControl && anchorRef.current?.focus) {
          event.preventDefault();
          anchorRef.current.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [Boolean(card), close]);

  return {
    card, open, close, pin, scheduleClose, cancelClose,
    popoverProps: {
      card, anchorRef, panelRef, onClose: close, onPin: pin,
      onPointerEnter: () => { hoveringPanelRef.current = true; cancelClose(); },
      onPointerLeave: () => { hoveringPanelRef.current = false; scheduleClose(); },
      onFocus: cancelClose,
      onBlur: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
      },
    },
  };
}

export default function TerminalEnrichmentPopover({
  card, anchorRef, panelRef, onClose, onPin, onPointerEnter, onPointerLeave,
  onFocus, onBlur, title, subtitle, demo = false, children, dockRef, getContentRight, topologyImage, onSpaceUnavailable,
}) {
  const headingId = useId();
  const subtitleId = useId();
  const [position, setPosition] = useState(null);
  const repositionRef = useRef(null);

  useLayoutEffect(() => {
    if (!card) { setPosition(null); return undefined; }
    let frame = null;
    const reposition = () => {
      const anchor = visibleAnchor(anchorRef.current);
      if (!anchor) { onClose(false); return; }
      const measured = panelRef.current?.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const region = visibleTerminalRegion(dockRef?.current);
      if (dockRef && !region) {
        if (panelRef.current) panelRef.current.style.visibility = 'hidden';
        setPosition(null); onSpaceUnavailable?.(true); return;
      }
      const dock = region && calculateEnrichmentDock(region, getContentRight?.(), viewport);
      // A terminal-bound panel may ONLY occupy verified blank space. Never
      // fall back to a floating overlay on top of CLI text, even when pinned.
      const next = dockRef ? dock : calculateEnrichmentPopoverPlacement(anchor, { height: measured?.height || 500 }, viewport, region);
      onSpaceUnavailable?.(!next);
      if (!next) {
        if (panelRef.current) panelRef.current.style.visibility = 'hidden';
        setPosition(null); return;
      }
      // xterm render/scroll events can fire before React commits. Enforce the
      // safe geometry immediately so new output never waits on a state render.
      if (panelRef.current) Object.assign(panelRef.current.style, {
        left: `${next.left}px`, top: `${next.top}px`, width: `${next.width}px`,
        height: next.height ? `${next.height}px` : '', maxHeight: `${next.maxHeight}px`, visibility: 'visible',
      });
      setPosition((previous) => previous && Object.keys(next).every((key) => previous[key] === next[key]) ? previous : next);
    };
    repositionRef.current = reposition;
    reposition();
    const queueReposition = () => {
      if (dockRef && panelRef.current) panelRef.current.style.visibility = 'hidden';
      if (frame != null) return;
      frame = window.requestAnimationFrame(() => { frame = null; reposition(); });
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(queueReposition) : null;
    if (panelRef.current) observer?.observe(panelRef.current);
    if (anchorRef.current) observer?.observe(anchorRef.current);
    if (dockRef?.current) observer?.observe(dockRef.current);
    window.addEventListener("resize", queueReposition);
    window.addEventListener("scroll", queueReposition, true);
    const terminalHost = dockRef?.current;
    terminalHost?.addEventListener('netclaw:terminal-layout', reposition);
    // Canvas transforms, xterm scrolls and new long output lines may not emit
    // a DOM resize. Recheck empty space only while details are visible.
    let monitorFrame;
    const monitor = () => { reposition(); monitorFrame = window.requestAnimationFrame(monitor); };
    monitorFrame = window.requestAnimationFrame(monitor);
    return () => {
      if (frame != null) window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(monitorFrame);
      terminalHost?.removeEventListener('netclaw:terminal-layout', reposition);
      onSpaceUnavailable?.(false);
      observer?.disconnect();
      window.removeEventListener("resize", queueReposition);
      window.removeEventListener("scroll", queueReposition, true);
      repositionRef.current = null;
    };
  }, [Boolean(card), anchorRef, panelRef, onClose, dockRef, getContentRight, onSpaceUnavailable]);

  useLayoutEffect(() => { repositionRef.current?.(); }, [card, children]);

  if (!card || typeof document === "undefined") return null;
  return createPortal(
    <section className={`terminal-enrichment-popover${demo ? " tep-demo" : ""}`} role="dialog" aria-modal="false"
      aria-labelledby={headingId} aria-describedby={subtitle ? subtitleId : undefined}
      data-placement={position?.placement} data-pinned={card.pinned ? "true" : "false"}
      data-contained={dockRef ? "true" : undefined}
      ref={panelRef} style={{ left: position?.left ?? 12, top: position?.top ?? 12,
        width: position?.width ?? "min(720px, calc(100vw - 24px))", maxHeight: position?.maxHeight ?? 500,
        height: position?.height,
        visibility: position ? "visible" : "hidden" }}
      onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocus={onFocus} onBlur={onBlur}
      onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <header className="tep-header">
        <div className="tep-heading">
          <span className="tep-dock-label">Network context</span>
          <h3 id={headingId}>{title}</h3>
          {subtitle && <p id={subtitleId}>{subtitle}</p>}
        </div>
        <div className="tep-actions">
          <button type="button" aria-pressed={card.pinned} onClick={onPin}
            title={card.pinned ? "Unpin this card so it closes when you leave it" : "Keep this route card open while you explore"}>
            {card.pinned ? "Unpin" : "Pin"}
          </button>
          <button type="button" aria-label="Close route information" onClick={() => onClose()}>Close</button>
        </div>
      </header>
      {demo && <div className="tep-demo-banner" role="note"><strong>FAKE DATA — DEMONSTRATION ONLY</strong>
        <span>Synthetic NetBox / ServiceNow examples. No live integration data.</span>
      </div>}
      <div className="tep-content">
        {topologyImage && <TopologyImage key={topologyImage.storageKey} {...topologyImage} address={title}
          onEngage={() => { if (!card.pinned) onPin(); }} />}
        {children}
      </div>
      <footer className="tep-footer"><span>{demo ? 'Demonstration only · no live data' : 'Context only · no commands executed by this pane'}</span><span>{card.pinned ? 'Pinned' : 'Click an address to pin'} · Esc to close</span></footer>
    </section>, document.body,
  );
}
