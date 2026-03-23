import React, { useEffect, useRef, useState, Suspense, lazy, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table as TableIcon,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Code2,
  Paperclip,
  Send,
  Smile,
  Type,
} from 'lucide-react';


// TYPES & INTERFACES 

export interface EditorFeatures {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  codeBlock?: boolean;
  link?: boolean;
  bulletList?: boolean;
  orderedList?: boolean;
  blockquote?: boolean;
  horizontalRule?: boolean;
  table?: boolean;
  image?: boolean;
  heading?: boolean;
  textAlign?: boolean;
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  autoFocus?: boolean;
  showToolbar?: boolean;
  features?: EditorFeatures;
}

// TOOLBAR MENU BAR COMPONENT

interface MenuBarProps {
  editor: any;
  features: EditorFeatures;
}

const MenuBar: React.FC<MenuBarProps> = ({ editor, features }) => {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const MenuButton = ({ onClick, isActive = false, disabled = false, children, title }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-2 rounded-lg transition-colors
        ${isActive
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60'
          : 'text-gray-600 dark:text-muted-foreground hover:bg-gray-100 dark:hover:bg-secondary hover:text-gray-900 dark:hover:text-foreground'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        flex items-center justify-center
      `}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-300 dark:bg-border mx-1" />;

  return (
    <div className="border-b border-gray-200 dark:border-border bg-gray-50 dark:bg-secondary px-3 py-2 rounded-t-lg flex flex-wrap items-center gap-1">
      {/* Undo/Redo */}
      <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className="w-4 h-4" />
      </MenuButton>
      <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className="w-4 h-4" />
      </MenuButton>
      <Divider />

      {/* Text Formatting */}
      {features.bold && (
        <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
          <Bold className="w-4 h-4" />
        </MenuButton>
      )}
      {features.italic && (
        <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
          <Italic className="w-4 h-4" />
        </MenuButton>
      )}
      {features.underline && (
        <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
      )}
      {features.strikethrough && (
        <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough className="w-4 h-4" />
        </MenuButton>
      )}
      {features.code && (
        <MenuButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">
          <Code className="w-4 h-4" />
        </MenuButton>
      )}
      <Divider />

      {/* Headings */}
      {features.heading && (
        <>
          <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="H1">
            <Heading1 className="w-4 h-4" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="H2">
            <Heading2 className="w-4 h-4" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="H3">
            <Heading3 className="w-4 h-4" />
          </MenuButton>
          <Divider />
        </>
      )}

      {/* Lists */}
      {features.bulletList && (
        <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
          <List className="w-4 h-4" />
        </MenuButton>
      )}
      {features.orderedList && (
        <MenuButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
      )}
      {(features.bulletList || features.orderedList) && <Divider />}

      {/* Block Elements */}
      {features.codeBlock && (
        <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block">
          <Code2 className="w-4 h-4" />
        </MenuButton>
      )}
      {features.blockquote && (
        <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote">
          <Quote className="w-4 h-4" />
        </MenuButton>
      )}
      {features.horizontalRule && (
        <MenuButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">
          <Minus className="w-4 h-4" />
        </MenuButton>
      )}
      {(features.codeBlock || features.blockquote || features.horizontalRule) && <Divider />}

      {/* Text Alignment */}
      {features.textAlign && (
        <>
          <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Left">
            <AlignLeft className="w-4 h-4" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Center">
            <AlignCenter className="w-4 h-4" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Right">
            <AlignRight className="w-4 h-4" />
          </MenuButton>
          <MenuButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify">
            <AlignJustify className="w-4 h-4" />
          </MenuButton>
          <Divider />
        </>
      )}

      {/* Insert Elements */}
      {features.link && (
        <MenuButton onClick={setLink} isActive={editor.isActive('link')} title="Link">
          <LinkIcon className="w-4 h-4" />
        </MenuButton>
      )}
      {features.table && (
        <MenuButton onClick={addTable} title="Table">
          <TableIcon className="w-4 h-4" />
        </MenuButton>
      )}
      {features.image && (
        <MenuButton onClick={addImage} title="Image">
          <ImageIcon className="w-4 h-4" />
        </MenuButton>
      )}
    </div>
  );
};

// EXTENSIONS CONFIGURATION 

const getExtensions = (placeholder: string, features: EditorFeatures) => {
  const defaultFeatures = {
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    code: true,
    codeBlock: true,
    link: true,
    bulletList: true,
    orderedList: true,
    blockquote: true,
    horizontalRule: true,
    table: true,
    image: true,
    heading: true,
    textAlign: true,
    ...features,
  };

  const extensions: any[] = [
    StarterKit.configure({
      bold: defaultFeatures.bold ? {} : false,
      italic: defaultFeatures.italic ? {} : false,
      strike: defaultFeatures.strikethrough ? {} : false,
      code: defaultFeatures.code ? {} : false,
      codeBlock: defaultFeatures.codeBlock ? {} : false,
      bulletList: defaultFeatures.bulletList ? {} : false,
      orderedList: defaultFeatures.orderedList ? {} : false,
      blockquote: defaultFeatures.blockquote ? {} : false,
      horizontalRule: defaultFeatures.horizontalRule ? {} : false,
      heading: defaultFeatures.heading ? { levels: [1, 2, 3, 4, 5, 6] } : false,
    }),
  ];

  if (defaultFeatures.underline) extensions.push(Underline);

  if (defaultFeatures.link) {
    extensions.push(
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer hover:text-blue-800' },
      })
    );
  }

  if (defaultFeatures.table) {
    extensions.push(
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell
    );
  }

  if (defaultFeatures.textAlign) {
    extensions.push(
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      })
    );
  }

  if (defaultFeatures.image) {
    extensions.push(Image.configure({ HTMLAttributes: { class: 'max-w-full h-auto rounded-lg' } }));
  }

  extensions.push(Placeholder.configure({ placeholder }));

  return extensions;
};

//  MAIN RICH TEXT EDITOR COMPONENT 

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Start typing...',
  readOnly = false,
  minHeight = '150px',
  maxHeight,
  className = '',
  features = {},
  autoFocus = false,
  showToolbar = true,
}) => {
  const editor = useEditor({
    extensions: getExtensions(placeholder, features),
    content: value,
    editable: !readOnly,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  if (!editor) return null;

  return (
    <div className={`border border-gray-300 dark:border-border rounded-lg bg-white dark:bg-card transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 dark:focus-within:ring-blue-900/40 ${readOnly ? 'bg-gray-50 dark:bg-muted' : ''} ${className}`}>
      {showToolbar && !readOnly && <MenuBar editor={editor} features={features} />}
      <div style={{ minHeight, ...(maxHeight && { maxHeight, overflowY: 'auto' }) }}>
        <EditorContent
          editor={editor}
          className="prose prose-sm dark:prose-invert max-w-none p-4 focus:outline-none
            [&_.ProseMirror]:outline-none
            [&_.ProseMirror]:min-h-[150px]
            [&_.ProseMirror]:relative
            [&_.ProseMirror]:text-gray-900
            dark:[&_.ProseMirror]:text-foreground
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400
            dark:[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:absolute 
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:left-0
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:top-0 
            [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
            [&_.ProseMirror_h1]:text-3xl
            [&_.ProseMirror_h1]:font-bold
            [&_.ProseMirror_h1]:mt-6
            [&_.ProseMirror_h1]:mb-3
            [&_.ProseMirror_h2]:text-2xl
            [&_.ProseMirror_h2]:font-bold
            [&_.ProseMirror_h2]:mt-5
            [&_.ProseMirror_h2]:mb-2
            [&_.ProseMirror_h3]:text-xl
            [&_.ProseMirror_h3]:font-semibold
            [&_.ProseMirror_h3]:mt-4
            [&_.ProseMirror_h3]:mb-2
            [&_.ProseMirror_ul]:list-disc
            [&_.ProseMirror_ul]:pl-6
            [&_.ProseMirror_ul]:my-2
            [&_.ProseMirror_ol]:list-decimal
            [&_.ProseMirror_ol]:pl-6
            [&_.ProseMirror_ol]:my-2
            [&_.ProseMirror_ol_li]:list-decimal 
            [&_.ProseMirror_blockquote]:border-l-4
            [&_.ProseMirror_blockquote]:border-gray-300
            [&_.ProseMirror_blockquote]:pl-4
            [&_.ProseMirror_blockquote]:italic
            [&_.ProseMirror_blockquote]:text-gray-600
            [&_.ProseMirror_blockquote]:my-4
            [&_.ProseMirror_code]:bg-gray-100
            [&_.ProseMirror_code]:text-red-600
            [&_.ProseMirror_code]:px-1
            [&_.ProseMirror_code]:py-0.5
            [&_.ProseMirror_code]:rounded
            [&_.ProseMirror_code]:text-sm
            [&_.ProseMirror_pre]:bg-gray-900
            [&_.ProseMirror_pre]:text-gray-100
            [&_.ProseMirror_pre]:rounded-lg
            [&_.ProseMirror_pre]:p-4
            [&_.ProseMirror_pre]:overflow-x-auto
            [&_.ProseMirror_pre]:my-4
            [&_.ProseMirror_pre_code]:bg-transparent
            [&_.ProseMirror_pre_code]:text-inherit
            [&_.ProseMirror_pre_code]:p-0
            [&_.ProseMirror_hr]:border-0
            [&_.ProseMirror_hr]:border-t-2
            [&_.ProseMirror_hr]:border-gray-300
            [&_.ProseMirror_hr]:my-6
            [&_.ProseMirror_table]:border-collapse
            [&_.ProseMirror_table]:w-full
            [&_.ProseMirror_table]:my-4
            [&_.ProseMirror_table_td]:border
            [&_.ProseMirror_table_td]:border-gray-300
            [&_.ProseMirror_table_td]:px-3
            [&_.ProseMirror_table_td]:py-2
            [&_.ProseMirror_table_th]:border
            [&_.ProseMirror_table_th]:border-gray-300
            [&_.ProseMirror_table_th]:bg-gray-50
            [&_.ProseMirror_table_th]:px-3
            [&_.ProseMirror_table_th]:py-2
            [&_.ProseMirror_table_th]:font-semibold
            [&_.ProseMirror_img]:max-w-full
            [&_.ProseMirror_img]:h-auto
            [&_.ProseMirror_img]:rounded-lg
            [&_.ProseMirror_img]:my-4
          "
        />
      </div>
    </div>
  );
};


// ─── CHAT MESSAGE INPUT ───────────────────────────────────────────────────────
// Teams-style chat input using Tiptap. Import & use in TeamChatModern.tsx.

const EmojiPickerLazy = lazy(() => import('emoji-picker-react'));

/** Features enabled for the chat input (lightweight set) */
const CHAT_FEATURES: EditorFeatures = {
  bold: true,
  italic: true,
  underline: true,
  strikethrough: true,
  code: true,
  codeBlock: false,
  bulletList: true,
  orderedList: true,
  blockquote: true,
  horizontalRule: false,
  table: false,
  image: false,
  heading: false,
  textAlign: false,
  link: false,
};

export interface ChatMessageInputProps {
  value: string;
  onChange: (plainText: string, html: string) => void;
  onSend: () => void;
  onAttachmentClick?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isUploading?: boolean;
  selectedFile?: File | null;
  filePreviewUrl?: string | null;
  onRemoveFile?: () => void;
}

/** Compact inline formatting toolbar that slides in above the editor */
const InlineFormatBar: React.FC<{ editor: any }> = ({ editor }) => {
  if (!editor) return null;

  const Btn = ({ onClick, active, title, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-all duration-150 ${
        active
          ? 'bg-blue-100 text-blue-700 shadow-inner'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-4 bg-gray-200 mx-0.5 self-center flex-shrink-0" />;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-gray-100 bg-gray-50/80 rounded-t-xl animate-in slide-in-from-top-1 duration-150">
      <Btn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline Code"
      >
        <Code className="w-3.5 h-3.5" />
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote className="w-3.5 h-3.5" />
      </Btn>
      <Sep />
      <Btn
        onClick={() => editor.chain().focus().undo().run()}
        active={false}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().redo().run()}
        active={false}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="w-3.5 h-3.5" />
      </Btn>
    </div>
  );
};

export const ChatMessageInput: React.FC<ChatMessageInputProps> = ({
  value,
  onChange,
  onSend,
  onAttachmentClick,
  placeholder = 'Type a message…',
  disabled = false,
  isUploading = false,
  selectedFile,
  filePreviewUrl,
  onRemoveFile,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatPanel, setShowFormatPanel] = useState(false);
  const emojiContainerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const editor = useEditor({
    extensions: getExtensions(placeholder, CHAT_FEATURES),
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const text = e.getText();
      onChange(text, html);
    },
  });

  // Sync external clear (value === '') back into the editor
  useEffect(() => {
    if (!editor) return;
    if (value === '' && editor.getText() !== '') {
      editor.commands.setContent('');
    }
  }, [value, editor]);

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  // Insert emoji at current cursor position
  const handleEmojiSelect = useCallback(
    (emojiData: any) => {
      if (!editor) return;
      editor.chain().focus().insertContent(emojiData.emoji).run();
      const html = editor.getHTML();
      const text = editor.getText();
      onChange(text, html);
      setShowEmojiPicker(false);
    },
    [editor, onChange]
  );

  // Send on Enter, new line on Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const hasContent = editor ? editor.getText().trim().length > 0 : false;
      if ((hasContent || selectedFile) && !isUploading) {
        onSend();
      }
    }
  };

  const canSend =
    !isUploading &&
    ((editor ? editor.getText().trim().length > 0 : false) || !!selectedFile);

    return (
    <div className="px-3 py-2 bg-white border-t border-gray-200">

      {/* Format toolbar — slides in above when toggled */}
      {showFormatPanel && <InlineFormatBar editor={editor} />}

      {/* File preview — shown above the input row when a file is attached */}
      {selectedFile && (
        <div className="mb-1.5 px-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 max-w-[300px]">
            {filePreviewUrl ? (
              <img src={filePreviewUrl} alt="preview" className="h-7 w-7 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="h-7 w-7 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Paperclip className="w-3.5 h-3.5 text-blue-500" />
              </div>
            )}
            <span className="truncate font-medium flex-1 min-w-0">{selectedFile.name}</span>
            <span className="text-blue-400 flex-shrink-0 whitespace-nowrap">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </span>
            {onRemoveFile && (
              <button
                type="button"
                onClick={onRemoveFile}
                className="flex-shrink-0 text-blue-400 hover:text-blue-700 transition-colors ml-1"
                title="Remove file"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

    {/* ── Single-row: editor + buttons + send ── */}
      <div
        className={`flex items-end gap-1 rounded-xl border bg-white overflow-visible transition-all duration-200 px-3 ${
          showFormatPanel
            ? 'border-blue-400 ring-1 ring-blue-100'
            : 'border-gray-300 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100'
        }`}
      >
        {/* Tiptap editor — grows to fill available width */}
        <div onKeyDown={handleKeyDown} className="flex-1 min-w-0">
          <EditorContent
            editor={editor}
            className="
              py-2 text-sm text-gray-900
              [&_.ProseMirror]:outline-none
              [&_.ProseMirror]:min-h-[22px]
              [&_.ProseMirror]:max-h-28
              [&_.ProseMirror]:overflow-y-auto
              [&_.ProseMirror_p]:m-0
              [&_.ProseMirror_p]:leading-snug
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:absolute
              [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none
              [&_.ProseMirror_p]:relative
              [&_.ProseMirror_strong]:font-semibold
              [&_.ProseMirror_em]:italic
              [&_.ProseMirror_u]:underline
              [&_.ProseMirror_s]:line-through
              [&_.ProseMirror_code]:bg-gray-100
              [&_.ProseMirror_code]:text-red-600
              [&_.ProseMirror_code]:px-1
              [&_.ProseMirror_code]:py-0.5
              [&_.ProseMirror_code]:rounded
              [&_.ProseMirror_code]:text-xs
              [&_.ProseMirror_code]:font-mono
              [&_.ProseMirror_ul]:list-disc
              [&_.ProseMirror_ul]:pl-5
              [&_.ProseMirror_ul]:my-1
              [&_.ProseMirror_ol]:list-decimal
              [&_.ProseMirror_ol]:pl-5
              [&_.ProseMirror_ol]:my-1
              [&_.ProseMirror_li]:my-0.5
              [&_.ProseMirror_blockquote]:border-l-4
              [&_.ProseMirror_blockquote]:border-gray-300
              [&_.ProseMirror_blockquote]:pl-3
              [&_.ProseMirror_blockquote]:text-gray-500
              [&_.ProseMirror_blockquote]:italic
              [&_.ProseMirror_blockquote]:my-1
            "
          />
        </div>

       {/* ── Right-side buttons — pinned to bottom, never shift on multiline ── */}
        <div className="flex items-center gap-0.5 flex-shrink-0 self-end pb-1.5">

          {/* Format toggle */}
          <button
            type="button"
            title={showFormatPanel ? 'Hide formatting' : 'Show formatting'}
            onClick={() => setShowFormatPanel(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${
              showFormatPanel
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            <Type className="w-4 h-4" />
          </button>

          {/* Emoji */}
          <div ref={emojiContainerRef} className="relative">
            <button
              type="button"
              title="Emoji"
              onClick={() => setShowEmojiPicker(v => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                showEmojiPicker
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-10 right-0 mb-1 z-[9999] shadow-2xl rounded-xl overflow-hidden">
                <Suspense
                  fallback={
                    <div
                      style={{ width: 320, height: 400 }}
                      className="bg-white border border-gray-200 rounded-xl flex items-center justify-center"
                    >
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  }
                >
                  <EmojiPickerLazy
                    onEmojiClick={handleEmojiSelect}
                    width={320}
                    height={400}
                    searchPlaceHolder="Search emoji…"
                    previewConfig={{ showPreview: false }}
                  />
                </Suspense>
              </div>
            )}
          </div>

          {/* Attachment */}
          {onAttachmentClick && (
            <button
              type="button"
              title="Attach file"
              onClick={onAttachmentClick}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          )}

          {/* Send — moved inside the border box, same row */}
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            title="Send message (Enter)"
            className={`p-1.5 rounded-lg transition-all duration-150 ${
              canSend
                ? 'text-blue-600 hover:bg-blue-50 active:scale-95'
                : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
 
};

// UTILITY

/**
 * Converts a subset of Markdown (##/###/** bold **) to HTML
 * so it can be fed directly into Tiptap's readOnly RichTextEditor.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  const htmlLines = lines.map(line => {
    // ### heading → <h3>, ## heading → <h2>, # heading → <h1>
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) return `<h3>${h3[1]}</h3>`;
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) return `<h2>${h2[1]}</h2>`;
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) return `<h1>${h1[1]}</h1>`;

    // Bullet list items
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) return `<li>${applyInline(bullet[1])}</li>`;

    // Numbered list items
    const numbered = line.match(/^\d+\.\s+(.*)/);
    if (numbered) return `<li>${applyInline(numbered[1])}</li>`;

    // Empty line → paragraph break
    if (line.trim() === '') return '<br>';

    return `<p>${applyInline(line)}</p>`;
  });

  // Wrap consecutive <li> in <ul>
  const joined = htmlLines.join('');
  return joined.replace(/(<li>.*?<\/li>)+/gs, match => `<ul>${match}</ul>`);
}

function applyInline(text: string): string {
  // **bold** → <strong>bold</strong>
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

export function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}