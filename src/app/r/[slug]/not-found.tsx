import { Button } from "@/components/ui/Button";

export default function PublicRecipeNotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="font-mono text-xl text-[var(--color-fg)]">
        Recipe not found
      </h1>
      <p className="font-mono text-sm text-[var(--color-fg-muted)]">
        This recipe was unpublished, or the link is wrong.
      </p>
      {/* The public 404 is the only way back for an outside user who
          landed on a dead share link — primary variant gets the full
          attention. Button primitive enforces tap-target minimums. */}
      <Button as="a" href="/" variant="primary" size="md">
        Back to Mini Manager
      </Button>
    </div>
  );
}
