"use client";

const PRESETS = [
  "#1A1A18", // ink
  "#B5532A", // terracotta
  "#C7959B", // dusty rose
  "#7C7A52", // moss
  "#445E62", // teal
  "#5E4B8B", // plum
  "#A35C00", // amber
  "#225522", // forest
  "#9B2C3E", // wine
  "#3E5C76", // slate blue
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-label={`Set accent to ${p}`}
            className={`w-9 h-9 rounded-full border-2 transition-transform ${
              value.toUpperCase() === p.toUpperCase()
                ? "border-ink scale-110"
                : "border-rule hover:scale-105"
            }`}
            style={{ backgroundColor: p }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-muted">Custom:</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1A1A18"
          className="font-mono text-sm w-28 rounded-md border border-rule bg-cream px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="w-6 h-6 rounded border border-rule" style={{ backgroundColor: value }} />
      </div>
    </div>
  );
}
