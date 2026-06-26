"use client";

import { type ReactNode } from "react";
import { useIsDesktop } from "@/hooks/useBreakpoint";
import { InspectorPane } from "./InspectorPane";
import { ProjectMobileSurface } from "./ProjectBottomSheet";

/**
 * Chooses the inspector surface for its breakpoint (DOP-002 / RF-10):
 *   - desktop (md+): the persistent in-flow InspectorPane (no scrim, the table
 *     stays visible to its left),
 *   - mobile (< md): the full-screen takeover (RF-10) with a top-left back
 *     chevron.
 *
 * Shared by the edit inspector (ProjectPanelStack) and the RF-8 create view so
 * "new project" reads as the same project page, blank. `open` gates the mobile
 * surface (which is an overlay); the desktop pane is mounted inline by the
 * caller only while open.
 */
export function InspectorShell({
  open,
  title,
  breadcrumb,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  breadcrumb?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    if (!open) return null;
    return (
      <InspectorPane title={title} breadcrumb={breadcrumb} onClose={onClose}>
        {children}
      </InspectorPane>
    );
  }

  return (
    <ProjectMobileSurface open={open} onClose={onClose} title={title} breadcrumb={breadcrumb}>
      {children}
    </ProjectMobileSurface>
  );
}
