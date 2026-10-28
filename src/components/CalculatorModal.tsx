"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Delete, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui";

type CalcState = {
  display: string;
  prev: number | null;
  op: string | null;
  fresh: boolean;
};

const INIT: CalcState = { display: "0", prev: null, op: null, fresh: false };

function compute(a: number, b: number, op: string) {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function formatDisplay(n: number) {
  if (!Number.isFinite(n)) return "Error";
  const rounded = Math.round(n * 1e10) / 1e10;
  return String(rounded);
}

export function CalculatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useLocale();
  const [state, setState] = useState<CalcState>(INIT);

  useEffect(() => {
    if (open) setState(INIT);
  }, [open]);

  const inputDigit = useCallback((digit: string) => {
    setState((s) => {
      if (s.display === "Error") return { ...INIT, display: digit };
      if (s.fresh) return { ...s, display: digit, fresh: false };
      if (digit === "." && s.display.includes(".")) return s;
      if (s.display === "0" && digit !== ".") return { ...s, display: digit };
      return { ...s, display: s.display + digit };
    });
  }, []);

  const clear = useCallback(() => setState(INIT), []);

  const backspace = useCallback(() => {
    setState((s) => {
      if (s.fresh || s.display === "Error") return s;
      const next = s.display.length <= 1 ? "0" : s.display.slice(0, -1);
      return { ...s, display: next };
    });
  }, []);

  const setOperator = useCallback((op: string) => {
    setState((s) => {
      const current = Number(s.display);
      if (s.prev != null && s.op && !s.fresh) {
        const result = compute(s.prev, current, s.op);
        return { display: formatDisplay(result), prev: result, op, fresh: true };
      }
      return { ...s, prev: current, op, fresh: true };
    });
  }, []);

  const equals = useCallback(() => {
    setState((s) => {
      if (s.prev == null || !s.op) return s;
      const current = Number(s.display);
      const result = compute(s.prev, current, s.op);
      return { display: formatDisplay(result), prev: null, op: null, fresh: true };
    });
  }, []);

  const percent = useCallback(() => {
    setState((s) => ({
      ...s,
      display: formatDisplay(Number(s.display) / 100),
      fresh: false,
    }));
  }, []);

  const toggleSign = useCallback(() => {
    setState((s) => {
      if (s.display === "0" || s.display === "Error") return s;
      return {
        ...s,
        display: s.display.startsWith("-") ? s.display.slice(1) : `-${s.display}`,
      };
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") inputDigit(e.key);
      else if (e.key === ".") inputDigit(".");
      else if (e.key === "+") setOperator("+");
      else if (e.key === "-") setOperator("-");
      else if (e.key === "*") setOperator("×");
      else if (e.key === "/") {
        e.preventDefault();
        setOperator("÷");
      } else if (e.key === "Enter" || e.key === "=") equals();
      else if (e.key === "Escape") onClose();
      else if (e.key === "Backspace") backspace();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, inputDigit, setOperator, equals, backspace, onClose]);

  const title = locale === "bn" ? "ক্যালকুলেটর" : "Calculator";

  const keys: { label: string; action: () => void; className?: string }[] = [
    { label: "C", action: clear, className: "gp-calc-fn" },
    { label: "±", action: toggleSign, className: "gp-calc-fn" },
    { label: "%", action: percent, className: "gp-calc-fn" },
    { label: "÷", action: () => setOperator("÷"), className: "gp-calc-op" },
    { label: "7", action: () => inputDigit("7") },
    { label: "8", action: () => inputDigit("8") },
    { label: "9", action: () => inputDigit("9") },
    { label: "×", action: () => setOperator("×"), className: "gp-calc-op" },
    { label: "4", action: () => inputDigit("4") },
    { label: "5", action: () => inputDigit("5") },
    { label: "6", action: () => inputDigit("6") },
    { label: "-", action: () => setOperator("-"), className: "gp-calc-op" },
    { label: "1", action: () => inputDigit("1") },
    { label: "2", action: () => inputDigit("2") },
    { label: "3", action: () => inputDigit("3") },
    { label: "+", action: () => setOperator("+"), className: "gp-calc-op" },
    { label: "0", action: () => inputDigit("0"), className: "col-span-2" },
    { label: ".", action: () => inputDigit(".") },
    { label: "=", action: equals, className: "gp-calc-eq" },
  ];

  return (
    <Modal open={open} title={title} onClose={onClose} compact>
      <div className="gp-calculator">
        <div className="gp-calculator__display" aria-live="polite">
          {state.display}
        </div>
        <div className="mb-2 flex justify-end gap-1">
          <button type="button" className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs" onClick={backspace}>
            <Delete className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="gp-btn gp-btn-ghost min-h-8 px-2 text-xs" onClick={clear}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="gp-calculator__keys">
          {keys.map((k) => (
            <button
              key={k.label + (k.className || "")}
              type="button"
              className={k.className || "gp-calc-key"}
              onClick={k.action}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
