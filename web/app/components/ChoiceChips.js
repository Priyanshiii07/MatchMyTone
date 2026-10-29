"use client";

import { PREFERENCE_FIELDS } from "../../lib/preferences";

/**
 * Accessible chip selector built on native radio/checkbox inputs.
 * Single-choice fields can be cleared, because every preference is optional.
 */
export default function ChoiceChips({ field, value, onChange, options, legend, help, multi, name, disabled = false }) {
  const spec = PREFERENCE_FIELDS[field] || {};
  // Retired options stay in the shared option file for older saved data but are never offered.
  const choices = (options || spec.options || []).filter((option) => !option.retired);
  const isMulti = multi ?? Boolean(spec.multi);
  const selected = isMulti ? (Array.isArray(value) ? value : []) : value || "";
  const inputName = name || `pref-${field}`;

  function toggle(optionValue) {
    if (!isMulti) { onChange(optionValue); return; }
    onChange(selected.includes(optionValue) ? selected.filter((item) => item !== optionValue) : [...selected, optionValue]);
  }

  return (
    <fieldset className="chip-field" disabled={disabled}>
      <legend>{legend || spec.label}</legend>
      {(help ?? spec.help) && <p className="chip-help">{help ?? spec.help}</p>}
      <div className="chip-row">
        {choices.map((option) => {
          const checked = isMulti ? selected.includes(option.value) : selected === option.value;
          return (
            <label key={option.value} className={`chip ${checked ? "is-selected" : ""}`}>
              <input type={isMulti ? "checkbox" : "radio"} name={inputName} value={option.value} checked={checked} onChange={() => toggle(option.value)} />
              <span>{option.label}</span>
            </label>
          );
        })}
        {!isMulti && selected && <button className="link-button chip-clear" type="button" onClick={() => onChange("")}>Clear</button>}
      </div>
    </fieldset>
  );
}
