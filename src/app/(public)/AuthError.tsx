"use client";

/** Server-error banner for the auth forms — composed from the design-system
 *  tokens (the kit's AuthView owns field validation; server errors surface
 *  here, above the panel). Pinned top-center so it reads as an OS alert. */
export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] border border-red bg-bg px-4 py-2 text-center font-mono text-xs text-red glow-cyan"
    >
      ▸ {message}
    </div>
  );
}
