import React, { Component, Suspense, lazy } from 'react';
import { C, COLLAPSED_H } from './canvas-theme.js';

// Loading/failure belongs to this window, not the whole canvas. Other SSH
// sessions remain mounted while an optional window downloads or fails to load.
export function createLazyLane(load, label) {
  const Initial = lazy(load);
  return class LazyLane extends Component {
    state = { Loaded: Initial, failed: false };
    static getDerivedStateFromError() { return { failed: true }; }

    retry = () => this.setState({ Loaded: lazy(load), failed: false });

    placeholder(failed) {
      const { node, laneRef, onFocus, onDelete, onDragStart } = this.props;
      return <div ref={laneRef} data-node-id={node.id} data-node-kind={node.kind}
        onMouseDown={onFocus} style={{ position: 'absolute', left: node.x, top: node.y,
          width: node.w, height: node.min ? COLLAPSED_H : node.h, zIndex: node.z,
          boxSizing: 'border-box', overflow: 'auto', background: C.card, color: C.ink,
          border: `1px solid ${C.hairline}`, borderRadius: 10, padding: 12 }}>
        <div onMouseDown={onDragStart} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span role={failed ? 'alert' : 'status'}>
            {failed ? `${label} could not load. Your saved window is unchanged.` : `Loading ${label}…`}
          </span>
          <button type="button" onMouseDown={event => event.stopPropagation()} onClick={onDelete} aria-label={`Close ${label}`}>Close</button>
        </div>
        {failed && <button type="button" onClick={this.retry}>Retry</button>}
      </div>;
    }

    render() {
      if (this.state.failed) return this.placeholder(true);
      const Loaded = this.state.Loaded;
      return <Suspense fallback={this.placeholder(false)}><Loaded {...this.props} /></Suspense>;
    }
  };
}
