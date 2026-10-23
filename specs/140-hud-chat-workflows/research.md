# Research

Vite currently binds loopback and middleware independently rejects remote clients. The API and WebSocket verifier share the same policy. Browser clients use same-origin /api and /ws paths, so only the UI listener needs external binding. Vite WebSocket upgrades need a separate guard because upgrades bypass HTTP middleware.

The checked-in contribution document references .claude/commands, which is absent in this checkout. Follow the available templates and the specification, clarification, plan, tasks, analysis, implementation sequence manually.
