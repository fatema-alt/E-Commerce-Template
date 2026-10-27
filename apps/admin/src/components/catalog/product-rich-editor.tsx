"use client";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { safeProductLink, toProductHtml } from "@commerce/product-content";
import { useEffect, useId, useState } from "react";

export default function ProductRichEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [length, setLength] = useState(value.length);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: false,
          isAllowedUri: safeProductLink,
        },
      }),
    ],
    content: toProductHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Full Description",
        "aria-multiline": "true",
        "aria-describedby": id,
        class: "product-rich-content",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setLength(html.length);
      onChange(html);
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const html = toProductHtml(value);
      if (html !== toProductHtml(editor.getHTML()))
        editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [editor, value]);
  const control = (
    label: string,
    action: () => void,
    active = false,
    unavailable = false,
  ) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled || !editor || unavailable}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {label}
    </button>
  );
  return (
    <div className="product-rich-editor full" aria-busy={!editor}>
      <p className="product-rich-label">Full Description</p>
      <div
        className="product-rich-toolbar"
        role="toolbar"
        aria-label="Description formatting"
      >
        {control(
          "Bold",
          () => editor?.chain().focus().toggleBold().run(),
          editor?.isActive("bold"),
        )}
        {control(
          "Italic",
          () => editor?.chain().focus().toggleItalic().run(),
          editor?.isActive("italic"),
        )}
        {control(
          "Underline",
          () => editor?.chain().focus().toggleUnderline().run(),
          editor?.isActive("underline"),
        )}
        {control(
          "Paragraph",
          () => editor?.chain().focus().setParagraph().run(),
          editor?.isActive("paragraph"),
        )}
        {control(
          "H2",
          () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          editor?.isActive("heading", { level: 2 }),
        )}
        {control(
          "H3",
          () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
          editor?.isActive("heading", { level: 3 }),
        )}
        {control(
          "Bullet list",
          () => editor?.chain().focus().toggleBulletList().run(),
          editor?.isActive("bulletList"),
        )}
        {control(
          "Numbered list",
          () => editor?.chain().focus().toggleOrderedList().run(),
          editor?.isActive("orderedList"),
        )}
        {control(
          "Blockquote",
          () => editor?.chain().focus().toggleBlockquote().run(),
          editor?.isActive("blockquote"),
        )}
        {control(
          "Link",
          () => {
            setUrl(editor?.getAttributes("link").href || "");
            setLinkError("");
            setLinkOpen((value) => !value);
          },
          editor?.isActive("link"),
        )}
        {control(
          "Undo",
          () => editor?.chain().focus().undo().run(),
          false,
          !editor?.can().undo(),
        )}
        {control(
          "Redo",
          () => editor?.chain().focus().redo().run(),
          false,
          !editor?.can().redo(),
        )}
        {control("Clear formatting", () =>
          editor?.chain().focus().unsetAllMarks().clearNodes().run(),
        )}
      </div>
      {linkOpen && (
        <div className="product-link-editor">
          <label>
            Link URL
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com or /shop"
            />
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              const href = url.trim();
              if (href && !safeProductLink(href)) {
                setLinkError(
                  "Use an http, https, mailto or relative store link.",
                );
                return;
              }
              if (href)
                editor
                  ?.chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href })
                  .run();
              else
                editor
                  ?.chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
              setLinkOpen(false);
            }}
          >
            Apply link
          </button>
          <button type="button" onClick={() => setLinkOpen(false)}>
            Cancel
          </button>
          {linkError && <p role="alert">{linkError}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
      {!editor && (
        <div className="product-rich-loading" role="status">
          Loading description editor…
        </div>
      )}
      <p
        className={
          length > 50000 ? "product-rich-error" : "product-editor-help"
        }
        id={id}
        role={length > 50000 ? "alert" : undefined}
      >
        {length.toLocaleString()} / 50,000 HTML characters. Bengali, English and
        emojis supported. Links and formatting are sanitized on save.
      </p>
    </div>
  );
}
