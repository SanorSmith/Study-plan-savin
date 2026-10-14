"use client";

import type { ReactNode } from "react";

/** A submit button that asks "are you sure?" first and cancels the form if the answer is no. */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
