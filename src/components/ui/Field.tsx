import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { clsx } from "clsx";

/**
 * Field primitives — gold-standard §04.
 *
 * The spec image's input set: a small-caps mono label ABOVE a white-border
 * control. <TextField> covers text / password / email / number / etc.,
 * <SelectField> adds the cyan chevron, <TextAreaField> the multi-line box.
 * All share the `.field` label-stack + `.field-control` white-border box
 * (focus lifts to cyan via the global input:focus-visible rule), so the
 * §04 look is one source of truth and every native input attribute
 * forwards straight through.
 *
 * Checkbox + radio (image §04: checked = cyan) are styled globally via
 * `accent-color`; <CheckField> / <RadioField> wrap a native control with
 * its label for the labelled-row idiom.
 */

interface FieldShellProps {
  label: ReactNode;
  /** Slot rendered below the control (validation / help text). */
  trailing?: ReactNode;
  /** Extra class on the outer `.field` stack. */
  className?: string;
}

interface TextFieldProps
  extends FieldShellProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {}

export function TextField({
  label,
  trailing,
  className,
  id,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={clsx("field", className)}>
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <input id={fieldId} className="field-control tap-target" {...inputProps} />
      {trailing}
    </div>
  );
}

interface SelectFieldProps
  extends FieldShellProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  children: ReactNode;
}

export function SelectField({
  label,
  trailing,
  className,
  id,
  children,
  ...selectProps
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={clsx("field", className)}>
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <select id={fieldId} className="field-control tap-target" {...selectProps}>
        {children}
      </select>
      {trailing}
    </div>
  );
}

interface TextAreaFieldProps
  extends FieldShellProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {}

export function TextAreaField({
  label,
  trailing,
  className,
  id,
  ...textareaProps
}: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={clsx("field", className)}>
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <textarea id={fieldId} className="field-control" {...textareaProps} />
      {trailing}
    </div>
  );
}

interface ToggleFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> {
  label: ReactNode;
  className?: string;
}

/** Checkbox row — native checkbox (cyan-checked via accent-color) + label. */
export function CheckField({ label, className, ...inputProps }: ToggleFieldProps) {
  return (
    <label className={clsx("field-toggle tap-target", className)}>
      <input type="checkbox" {...inputProps} />
      <span className="field-toggle-label">{label}</span>
    </label>
  );
}

/** Radio row — native radio (cyan-selected via accent-color) + label. */
export function RadioField({ label, className, ...inputProps }: ToggleFieldProps) {
  return (
    <label className={clsx("field-toggle tap-target", className)}>
      <input type="radio" {...inputProps} />
      <span className="field-toggle-label">{label}</span>
    </label>
  );
}
