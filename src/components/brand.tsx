import { Route } from "lucide-react";
export const PRODUCT_NAME = "DegreePath";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Route size={22} />
      </span>
      {PRODUCT_NAME}
      <span className="brand-period">.</span>
    </span>
  );
}
export function Disclaimer() {
  return (
    <p className="disclaimer">
      DegreePath is a planning tool and is not an official University of
      Washington degree audit. Course offerings and degree requirements may
      change. Verify important decisions with official UW resources or an
      academic adviser.
    </p>
  );
}
