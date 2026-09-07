import React, { useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import styles from './SafeHtmlEditor.module.css';

const tools = [
  { label: 'Título', before: '<h2>', after: '</h2>', placeholder: 'Título de sección' },
  { label: 'Subtítulo', before: '<h3>', after: '</h3>', placeholder: 'Subtítulo' },
  { label: 'Párrafo', before: '<p>', after: '</p>', placeholder: 'Escribe el contenido' },
  { label: 'Negrita', before: '<strong>', after: '</strong>', placeholder: 'texto importante' },
  { label: 'Cursiva', before: '<em>', after: '</em>', placeholder: 'texto' },
];

const SafeHtmlEditor = ({ id, label, value, onChange }) => {
  const inputRef = useRef(null);
  const preview = useMemo(() => DOMPurify.sanitize(value || ''), [value]);

  const wrapSelection = ({ before, after, placeholder }) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertList = () => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = value.slice(start, end) || 'Primer punto\nSegundo punto';
    const items = selected.split(/\r?\n/).filter(Boolean).map((line) => `  <li>${line}</li>`).join('\n');
    const block = `<ul>\n${items}\n</ul>`;
    onChange(`${value.slice(0, start)}${block}${value.slice(end)}`);
    window.requestAnimationFrame(() => input.focus());
  };

  return (
    <section className={styles.editor}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <p className={styles.help}>Selecciona texto y usa los botones. La vista previa sólo permite formato legal seguro.</p>
      <div className={styles.toolbar} aria-label={`Formato para ${label}`}>
        {tools.map((tool) => (
          <button type="button" key={tool.label} onClick={() => wrapSelection(tool)}>{tool.label}</button>
        ))}
        <button type="button" onClick={insertList}>Lista</button>
      </div>
      <div className={styles.columns}>
        <div>
          <span className={styles.columnTitle}>Contenido</span>
          <textarea
            id={id}
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={styles.textarea}
            spellCheck
          />
        </div>
        <div>
          <span className={styles.columnTitle}>Vista previa segura</span>
          <article className={styles.preview} dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      </div>
    </section>
  );
};

export default SafeHtmlEditor;
