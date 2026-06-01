/**
 * R7-006 — cyan-on-buttons sweep sentinel.
 *
 * The Round-7 auditor caught 10+ buttons that had drifted back to
 * `variant="primary"` (cyan-filled CTA) despite the Phase-12 P12.23
 * rule reserving cyan for auth / sign-in / confirm. This file enforces
 * the corrected discipline:
 *
 *   - ADD / CREATE / NEW / ATTACH / ASSIGN / SAVE  → variant="success"
 *   - SHARE / SEND / EXPORT                         → variant="warning"
 *   - SEARCH / MATCH / non-CTA action               → variant="secondary"
 *   - AUTH (sign-in / sign-up / forgot / reset)     → variant="primary"
 *   - CONFIRM / PUBLISH / final-step nav            → variant="primary"
 *
 * Each test reads the offending source file and pins the new variant
 * by exact-string assertion. A regression that flips a file back to
 * primary fails the suite.
 */
import { describe, expect, test } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../../", rel),
    "utf-8",
  );
}

describe("R7-006 — ADD / SAVE / ATTACH buttons flipped to success (green)", () => {
  test("AttachRecipeTrigger default variant resolves to success", () => {
    const src = read("src/components/recipes/AttachRecipeTrigger.tsx");
    // The prop alias `variant === "primary"` now maps to the success
    // ButtonVariant string. The "primary" prop name stays for back-
    // compat but the rendered button is green.
    expect(src).toContain('variant={variant === "primary" ? "success"');
    expect(src).not.toContain('variant={variant === "primary" ? "primary"');
  });

  test("RecipeActionsBar 'Assign to project ▾' button uses success", () => {
    const src = read("src/components/recipes/RecipeActionsBar.tsx");
    // Find the BUTTON occurrence (rendered JSX), not the docblock
    // mention. The JSX one is the last `Assign to project ▾` in the
    // file — search from the end.
    const idx = src.lastIndexOf("Assign to project ▾");
    expect(idx).toBeGreaterThan(0);
    const before = src.slice(Math.max(0, idx - 400), idx);
    expect(before).toContain('variant="success"');
    // The button block itself never carries variant="primary" after R7-006.
    expect(before).not.toMatch(/variant="primary"\s*$/m);
  });

  // P13.4 — AddNamedModelForm removed (named_model entity dropped).

  test("ChangePasswordCard 'Change password' uses success", () => {
    const src = read("src/components/user/ChangePasswordCard.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Change password/);
  });

  test("LibraryBrandFilterCard 'Save filter' uses success", () => {
    const src = read("src/components/user/LibraryBrandFilterCard.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Save filter/);
  });

  test("EyedropperClient 'Use camera' uses success", () => {
    const src = read("src/components/tools/eyedropper/EyedropperClient.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Use camera/);
  });

  test("PaletteSaveDialog 'Save' uses success", () => {
    const src = read("src/components/tools/PaletteSaveDialog.tsx");
    // Match the save submit button block — find "Save" in the button
    // body with the variant pinned above it.
    expect(src).toMatch(/variant="success"[\s\S]{0,200}>\s*Save\s*<\/Button>/);
  });

  test("RecoveryEmailCard add/update uses success", () => {
    const src = read("src/components/user/RecoveryEmailCard.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?email \? "Update" : "Add"/);
  });

  test("WishlistDetailDrawer 'Save' uses success", () => {
    const src = read("src/components/wishlist/WishlistDetailDrawer.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Saving…/);
  });

  test("MarkBoughtModal '✓ Mark bought' uses success", () => {
    const src = read("src/components/wishlist/MarkBoughtModal.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Mark bought/);
  });

  test("PaintSlotPicker 'Use hex' uses success", () => {
    const src = read("src/components/recipes/PaintSlotPicker.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Use hex/);
  });

  test("projects/[id] '+ Add unit' uses success", () => {
    const src = read("src/app/projects/[id]/page.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Add unit/);
  });

  test("AttachRecipeModal 'Move attachment' uses success", () => {
    const src = read("src/components/recipes/AttachRecipeModal.tsx");
    expect(src).toMatch(/variant="success"[\s\S]*?Move attachment/);
  });

  test("RecipesTable 'Assign ▾' uses success", () => {
    const src = read("src/components/recipes/RecipesTable.tsx");
    expect(src).toMatch(/variant="success"[\s\S]{0,200}Assign ▾/);
  });
});

describe("R7-006 — SHARE / SEND buttons flipped to warning (yellow)", () => {
  test("ToolFooterActions 'Send to recipe' uses warning", () => {
    const src = read("src/components/tools/ToolFooterActions.tsx");
    expect(src).toMatch(/variant="warning"[\s\S]*?Send to recipe/);
  });

  test("SendToRecipeModal submit 'Send →' uses warning", () => {
    const src = read("src/components/tools/SendToRecipeModal.tsx");
    expect(src).toMatch(/variant="warning"[\s\S]*?Sending…/);
  });
});

describe("R7-006 — search / analytical buttons flipped to secondary", () => {
  test("MatchClient 'Match' uses secondary (cyan outline, not fill)", () => {
    const src = read("src/components/tools/match/MatchClient.tsx");
    expect(src).toMatch(/variant="secondary"[\s\S]*?>\s*Match\s*<\/Button>/);
  });
});

describe("R7-006 — legitimate primary survivors", () => {
  /**
   * The auth-page CTAs and final-step confirms keep their cyan fill —
   * those uses match the Phase-12 docstring: save / confirm / sign-in.
   * This sentinel pins them so a future "purge ALL cyan" sweep doesn't
   * accidentally take out the sign-in button.
   */
  const authPages: ReadonlyArray<{ rel: string; label: string }> = [
    { rel: "src/app/sign-in/SignInForm.tsx", label: "Sign in" },
    { rel: "src/app/sign-up/SignUpForm.tsx", label: "sign-up" },
    { rel: "src/app/sign-in/forgot/ForgotPasswordForm.tsx", label: "forgot" },
    { rel: "src/app/sign-in/reset/ResetPasswordForm.tsx", label: "reset" },
    { rel: "src/app/finish-account/FinishAccountForm.tsx", label: "finish-account" },
  ];

  for (const { rel, label } of authPages) {
    test(`${label} keeps variant="primary"`, () => {
      const src = read(rel);
      expect(src).toContain('variant="primary"');
    });
  }

  test("ShareModal 'Publish' keeps variant=\"primary\" (final commit)", () => {
    const src = read("src/components/recipes/ShareModal.tsx");
    expect(src).toMatch(/variant="primary"[\s\S]*?Publishing…/);
  });

  test("r/[slug] not-found 'Back to Mini Manager' keeps primary", () => {
    const src = read("src/app/r/[slug]/not-found.tsx");
    expect(src).toContain('variant="primary"');
  });
});
