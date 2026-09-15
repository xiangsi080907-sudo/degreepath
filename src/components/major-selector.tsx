"use client";
import { SUPPORTED_MAJORS, programKey } from "@/data/majors";
export function MajorSelector({
  value,
  available,
  onChange,
  disabled = false,
}: {
  value: string;
  available: string[];
  onChange: (key: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="major-selector">
      <legend>What are you studying?</legend>
      <p className="muted-text">University of Washington · Seattle</p>
      <div className="major-options">
        {SUPPORTED_MAJORS.filter((m) => available.includes(programKey(m))).map(
          (m) => (
            <label
              className={
                value === programKey(m)
                  ? "major-option selected"
                  : "major-option"
              }
              key={m.id}
            >
              <input
                type="radio"
                name="major"
                value={programKey(m)}
                checked={value === programKey(m)}
                disabled={disabled}
                onChange={() => onChange(programKey(m))}
              />
              <strong>{m.displayName}</strong>
              <span>{m.school}</span>
              <small>{m.description}</small>
              <span className="pill">{m.coverage}</span>
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}
