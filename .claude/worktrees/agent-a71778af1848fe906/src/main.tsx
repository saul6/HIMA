import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Evita que el traductor del navegador (Google Translate) rompa React al reescribir
// nodos de texto fuera del control de React → NotFoundError: removeChild / insertBefore.
if (typeof Node !== 'undefined') {
  const _rc = Node.prototype.removeChild
  // @ts-expect-error — override intencional para resiliencia ante traductores
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) return child
    return _rc.call(this, child)
  }
  const _ib = Node.prototype.insertBefore
  // @ts-expect-error — override intencional para resiliencia ante traductores
  Node.prototype.insertBefore = function (node, ref) {
    if (ref && ref.parentNode !== this) return node
    return _ib.call(this, node, ref)
  }
}

createRoot(document.getElementById("root")!).render(<App />);
