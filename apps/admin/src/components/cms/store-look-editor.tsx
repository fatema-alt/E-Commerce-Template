"use client";
import { SchemaField, button } from "./schema-fields";
import type { Asset, Schema, Value } from "./cms-api";
import {
  applyThemePreset,
  STORE_GROUPS,
  THEME_PRESETS,
} from "./cms-task-config";
type Props = {
  kind: "SITE_SETTINGS" | "THEME";
  schema: Schema;
  content: Record<string, Value>;
  assets: Asset[];
  onChange: (value: Record<string, Value>) => void;
};
export function StoreLookEditor({
  kind,
  schema,
  content,
  assets,
  onChange,
}: Props) {
  const fields = (names: readonly string[], title: string) => (
    <SchemaField
      name={title}
      schema={{
        ...schema,
        properties: Object.fromEntries(
          Object.entries(schema.properties || {}).filter(([name]) =>
            names.includes(name),
          ),
        ),
        required: (schema.required || []).filter((name) =>
          names.includes(name),
        ),
      }}
      value={content}
      assets={assets}
      onChange={(value) => onChange(value as Record<string, Value>)}
    />
  );
  const groups = kind === "SITE_SETTINGS" ? STORE_GROUPS : [];
  const simpleTheme = ["primary", "fontFamily", "buttonStyle"];
  const visible =
    kind === "SITE_SETTINGS"
      ? groups.flatMap((group) => [...group.fields])
      : simpleTheme;
  const advanced = Object.keys(schema.properties || {}).filter(
    (name) => !visible.includes(name),
  );
  return (
    <div className="cms-task-editor">
      {kind === "THEME" ? (
        <>
          <section aria-labelledby="look-presets">
            <h2 id="look-presets">Choose a look</h2>
            <p>
              Choose a starting point, then adjust your brand color, font and
              buttons. Nothing goes live until you publish.
            </p>
            <div className="cms-look-presets">
              {THEME_PRESETS.map((preset) => (
                <button
                  type="button"
                  className={button}
                  key={preset.name}
                  onClick={() => onChange(applyThemePreset(content, preset))}
                >
                  <span className="cms-preset-swatches" aria-hidden="true">
                    {[
                      preset.values.primary,
                      preset.values.background,
                      preset.values.accent,
                    ].map((color) => (
                      <i key={color} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <strong>{preset.name}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>
          </section>
          <section aria-labelledby="look-brand">
            <h2 id="look-brand">Make it yours</h2>
            <div className="cms-brand-controls">
              {[
                ["primary", "Brand color"],
                ["fontFamily", "Font"],
                ["buttonStyle", "Button style"],
              ].map(([name, title]) => (
                <SchemaField
                  key={name}
                  name={title}
                  schema={schema.properties![name]}
                  value={
                    content[name] ??
                    (name === "primary"
                      ? "#48725C"
                      : name === "fontFamily"
                        ? "system"
                        : "solid")
                  }
                  assets={assets}
                  onChange={(value) => onChange({ ...content, [name]: value })}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <p>
            Manage your store identity and customer contact options together.
            Save a draft to keep your work private; publish when ready.
          </p>
          <nav aria-label="Store info sections" className="cms-store-sections">
            {groups.map((group) => (
              <a key={group.id} href={"#" + group.id}>
                {group.title}
              </a>
            ))}
          </nav>
          {groups.map((group) => (
            <section
              key={group.id}
              id={group.id}
              aria-labelledby={group.id + "-title"}
            >
              <h2 id={group.id + "-title"}>{group.title}</h2>
              {fields(group.fields, group.title)}
            </section>
          ))}
        </>
      )}
      <details className="cms-advanced">
        <summary>Advanced</summary>
        <p>
          {kind === "SITE_SETTINGS"
            ? "Header, footer, legal links, regional settings and homepage configuration."
            : "Fine-tune all colors, typography, spacing and layout styles."}
        </p>
        {fields(advanced, "Additional options")}
      </details>
    </div>
  );
}
