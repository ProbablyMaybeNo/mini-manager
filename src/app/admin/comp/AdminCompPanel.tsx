"use client";

import { useState, useTransition } from "react";
import { Button, EmptyState, Input, Panel, useToast } from "@/components/kit";
import { grantCompAccess, revokeCompAccess } from "@/lib/actions/adminComp";
import type { CompedUser } from "@/db/queries/users";

/**
 * Subscription-paywall admin comp panel (fix 5, Ross's review pass) —
 * enter a username, Grant or Revoke. The comped list below refreshes from
 * the action's own result rather than a full page reload, so granting/
 * revoking several accounts in a row stays fast.
 */
export function AdminCompPanel({
  initialComped,
}: {
  initialComped: ReadonlyArray<CompedUser>;
}) {
  const [comped, setComped] = useState<CompedUser[]>([...initialComped]);
  const [username, setUsername] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast, node } = useToast();

  function grant() {
    const name = username.trim();
    if (!name || pending) return;
    startTransition(async () => {
      const res = await grantCompAccess({ username: name });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      setComped((prev) => [
        {
          id: res.data.id,
          username: res.data.username,
          email: res.data.email,
          freeForeverGrantedAt: res.data.compGrantedAt!,
        },
        ...prev.filter((c) => c.id !== res.data.id),
      ]);
      setUsername("");
      toast(`Comped ${res.data.username ?? name}`, "green");
    });
  }

  function revoke(target: CompedUser) {
    if (pending) return;
    startTransition(async () => {
      const res = await revokeCompAccess({ username: target.username ?? "" });
      if (!res.ok) {
        toast(res.error, "red");
        return;
      }
      setComped((prev) => prev.filter((c) => c.id !== target.id));
      toast(`Revoked ${target.username ?? target.id}`, "green");
    });
  }

  return (
    <>
      <Panel label="GRANT COMP ACCESS" cornerTicks className="flex flex-col gap-3 p-4">
        <div className="flex items-end gap-2">
          <Input
            label="Username"
            name="comp-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && grant()}
            containerClassName="flex-1"
          />
          <Button variant="add" disabled={pending || !username.trim()} onClick={grant}>
            Grant
          </Button>
        </div>
      </Panel>

      <Panel label="CURRENTLY COMPED" cornerTicks className="p-4">
        {comped.length === 0 ? (
          <EmptyState glyph="⌖" title="Nobody comped" hint="Granted accounts show up here." />
        ) : (
          <ul className="flex flex-col gap-2">
            {comped.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-body text-body text-fg">
                    {c.username ?? c.id}
                  </p>
                  <p className="truncate font-body text-[11px] text-fg-dim">
                    {c.email ?? "no email"} · granted{" "}
                    {c.freeForeverGrantedAt.toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outlineRed"
                  size="sm"
                  disabled={pending}
                  onClick={() => revoke(c)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {node}
    </>
  );
}
