import { WheelClient } from "@/components/tools/wheel/WheelClient";

/**
 * Server shell for the Colour Wheel. Auth is enforced at the layout
 * level once gated; for now the client owns all interactive state and
 * loads the paint catalog itself (matches Library + Match patterns).
 */
export default function WheelToolPage() {
  return <WheelClient />;
}
