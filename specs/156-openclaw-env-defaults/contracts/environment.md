# Environment Resolution Contract

Native configuration accepts bare uppercase `${NAME}` references and literal strings. Optional defaults are catalog data; never pass shell fallback syntax to a runtime. Explicit nonempty values stay references in native config. Empty optional settings become literal empty strings. Required missing values retain their bare reference and remain configuration-required.

Preparation reads only the selected private environment (legacy generator retains its existing process input semantics with selected dotenv precedence); no values appear in logs. Source defaults include URL fields and renamed environment destinations. Existing custom values win during merge; known old template expressions are migrated. Malformed custom expressions fail safely rather than reaching child processes.
