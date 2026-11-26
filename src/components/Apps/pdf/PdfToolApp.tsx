import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Button, Checkbox, Input, Spinner, Tab, TabList, Textarea } from '@fluentui/react-components';
import {
  ArrowDownRegular, ArrowDownloadRegular, ArrowUpRegular, DeleteRegular, DocumentAddRegular,
  DocumentRegular, FolderOpenRegular, ImageRegular, TextAddRegular,
} from '@fluentui/react-icons';
import { PdfPreview } from './PdfPreview';
import {
  fillPdf, inspectPdf, mergePdfs, splitPdf, watermarkPdf,
  type FormEdit, type FormField, type PdfInput, type PdfOutput, type TextMark, type WatermarkOptions,
} from './pdfOperations';
import type { CompressionReply } from './compressPdf.worker';
import { notify } from '../../../store/useNotificationStore';
import './pdfTool.css';

const tools = [
  ['view', 'View'], ['fill', 'Form Fill'], ['merge', 'Merge'],
  ['split', 'Split'], ['watermark', 'Watermark'], ['compress', 'Compress'],
] as const;
type Tool = (typeof tools)[number][0];

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  const inKb = bytes / 1024;
  return inKb < 1024 ? inKb.toFixed(1) + ' KB' : (inKb / 1024).toFixed(2) + ' MB';
}

function downloadPdf(output: PdfOutput) {
  const url = URL.createObjectURL(new Blob([output.bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = output.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function EditField({ field, value, onChange }: {
  field: FormField;
  value: FormEdit[string] | undefined;
  onChange: (value: FormEdit[string]) => void;
}) {
  if (field.kind === 'check') {
    return <Checkbox label={field.name} checked={typeof value === 'boolean' ? value : field.value} onChange={(_, data) => onChange(data.checked === true)} />;
  }
  if (field.kind === 'text') {
    const text = typeof value === 'string' ? value : field.value;
    return (
      <label className="pdf-field">
        <span>{field.name}</span>
        {field.multiline
          ? <Textarea value={text} maxLength={field.maxLength} onChange={(_, data) => onChange(data.value)} />
          : <Input value={text} maxLength={field.maxLength} onChange={(_, data) => onChange(data.value)} />}
      </label>
    );
  }
  if (field.kind === 'radio') {
    const selection = typeof value === 'string' ? value : field.value;
    return (
      <fieldset className="pdf-radio">
        <legend>{field.name}</legend>
        {field.options.map((option, index) => (
          <label key={index}><input type="radio" name={field.name} checked={selection === option} onChange={() => onChange(option)} /> {option}</label>
        ))}
        {selection && <Button size="small" appearance="subtle" onClick={() => onChange('')}>Clear selection</Button>}
      </fieldset>
    );
  }
  const selection = Array.isArray(value) ? value : field.value;
  const choices = [...new Set([...field.options, ...selection])];
  return (
    <label className="pdf-field">
      <span>{field.name}</span>
      <select
        aria-label={field.name}
        multiple={field.multiple}
        value={field.multiple ? selection : selection[0] ?? ''}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value).filter(Boolean))}
      >
        {!field.multiple && <option value="">Select an option</option>}
        {choices.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default function PdfToolApp() {
  const [tool, setTool] = useState<Tool>('view');
  const [inputs, setInputs] = useState<PdfInput[]>([]);
  const [activeId, setActiveId] = useState('');
  const [page, setPage] = useState(1);
  const [outputs, setOutputs] = useState<PdfOutput[]>([]);
  const [outputIndex, setOutputIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState<'open' | 'run' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isDropTarget, setDropTarget] = useState(false);
  const [formEdits, setFormEdits] = useState<FormEdit>({});
  const [marks, setMarks] = useState<TextMark[]>([]);
  const [placing, setPlacing] = useState(false);
  const [activeMarkId, setActiveMarkId] = useState('');
  const [splitRange, setSplitRange] = useState('');
  const [splitSeparate, setSplitSeparate] = useState(false);
  const [watermarkType, setWatermarkType] = useState<'text' | 'logo'>('text');
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkLogo, setWatermarkLogo] = useState<File | null>(null);
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkOptions['position']>('center');
  const [opacity, setOpacity] = useState(30);
  const [watermarkRange, setWatermarkRange] = useState('');
  const [strong, setStrong] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const logoPicker = useRef<HTMLInputElement>(null);
  const markEditor = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const jobId = useRef(0);
  const cancelCompression = useRef<(() => void) | null>(null);

  const input = inputs.find((item) => item.id === activeId);
  const output = outputIndex === null ? undefined : outputs[outputIndex];
  const preview = output ?? input;
  const mark = marks.find((item) => item.id === activeMarkId);
  const toolName = tools.find(([value]) => value === tool)?.[1];

  useEffect(() => () => {
    jobId.current += 1;
    cancelCompression.current?.();
  }, []);

  useEffect(() => {
    if (activeMarkId) markEditor.current?.focus();
  }, [activeMarkId]);

  function cancelJob() {
    jobId.current += 1;
    cancelCompression.current?.();
    setBusy(null);
    return jobId.current;
  }

  function clearResult() {
    setOutputs([]);
    if (outputIndex !== null) setPage(1);
    setOutputIndex(null);
    setNotice('');
    setError('');
  }

  function activate(id: string) {
    setActiveId(id);
    setPage(1);
    setFormEdits({});
    setMarks([]);
    setActiveMarkId('');
    setPlacing(false);
    setSplitRange('');
    setWatermarkRange('');
    clearResult();
  }

  function changeTool(value: Tool) {
    if (tool === value) return;
    cancelJob();
    clearResult();
    setPlacing(false);
    setTool(value);
  }

  async function openFiles(files: File[]) {
    if (!files.length) return;
    const request = cancelJob();
    clearResult();
    setBusy('open');
    const loaded: PdfInput[] = [];
    try {
      for (const file of files) {
        try {
          loaded.push(await inspectPdf(file));
        } catch (reason) {
          throw new Error(file.name + ' — ' + (reason instanceof Error ? reason.message : 'This file could not be opened.'));
        }
        if (request !== jobId.current) return;
      }
      const isMerge = tool === 'merge' || loaded.length > 1;
      if (isMerge) setTool('merge');
      setInputs(tool === 'merge' ? [...inputs, ...loaded] : loaded);
      activate(loaded[0].id);
    } catch (reason) {
      if (request === jobId.current) setError(reason instanceof Error ? reason.message : 'Could not open these files.');
    } finally {
      if (request === jobId.current) setBusy(null);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDropTarget(false);
    void openFiles(Array.from(event.dataTransfer.files));
  }

  function moveFile(index: number, step: number) {
    clearResult();
    setInputs((old) => {
      const reordered = old.slice();
      const [file] = reordered.splice(index, 1);
      reordered.splice(index + step, 0, file);
      return reordered;
    });
  }

  function removeFile(id: string) {
    cancelJob();
    clearResult();
    const remaining = inputs.filter((item) => item.id !== id);
    setInputs(remaining);
    if (id === activeId) activate(remaining[0]?.id ?? '');
  }

  function showOutput(index: number | null) {
    setOutputIndex(index);
    setPage(1);
    setPlacing(false);
  }

  function placeText(position: Pick<TextMark, 'page' | 'x' | 'y' | 'angle'>) {
    const id = crypto.randomUUID();
    clearResult();
    setMarks((old) => [...old, { ...position, id, size: 14, text: '' }]);
    setActiveMarkId(id);
    setPlacing(false);
  }

  function editMark(id: string, changes: Partial<Pick<TextMark, 'text' | 'size'>>) {
    clearResult();
    setMarks((old) => old.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  function compress(source: PdfInput) {
    return new Promise<PdfOutput[]>((resolve, reject) => {
      const worker = new Worker(new URL('./compressPdf.worker.ts', import.meta.url), { type: 'module' });
      const finish = () => {
        worker.terminate();
        cancelCompression.current = null;
      };
      cancelCompression.current = () => {
        finish();
        reject(new Error('Compression cancelled.'));
      };
      worker.onmessage = ({ data }: MessageEvent<CompressionReply>) => {
        finish();
        if ('error' in data) reject(new Error(data.error));
        else if (data.bytes.byteLength >= source.bytes.byteLength) resolve([]);
        else resolve([{ name: source.name.replace(/\.pdf$/i, '') + '-compressed.pdf', bytes: data.bytes }]);
      };
      worker.onerror = () => {
        finish();
        reject(new Error('The compression worker stopped. Try a smaller file or use Keep quality.'));
      };
      worker.postMessage({ bytes: source.bytes, strong });
    });
  }

  async function runTool() {
    if (!input || busy) return;
    const request = cancelJob();
    clearResult();
    setBusy('run');
    setPlacing(false);
    try {
      let result: PdfOutput[];
      switch (tool) {
        case 'merge':
          result = await mergePdfs(inputs);
          break;
        case 'split':
          result = await splitPdf(input, splitRange, splitSeparate);
          break;
        case 'fill':
          result = await fillPdf(input, formEdits, marks);
          break;
        case 'watermark':
          result = await watermarkPdf(input, {
            content: watermarkType === 'logo' && watermarkLogo ? { image: watermarkLogo } : { text: watermarkText },
            position: watermarkPosition, opacity: opacity / 100, range: watermarkRange,
          });
          break;
        case 'compress':
          result = await compress(input);
          break;
        default:
          return;
      }
      if (request !== jobId.current) return;
      if (!result.length) {
        setNotice('This mode did not produce a smaller file. Keep your original.');
        return;
      }
      setOutputs(result);
      showOutput(0);
      notify({
        source: 'PDF Tool',
        title: result.length === 1 ? 'PDF ready' : `${result.length} PDFs ready`,
        message: result.length === 1 ? result[0].name : `Processed ${input.name}.`,
        kind: 'success',
        target: { appId: 'pdf-tool' },
      });
    } catch (reason) {
      if (request === jobId.current) {
        const message = reason instanceof Error ? reason.message : 'The PDF operation failed.';
        setError(message);
        notify({ source: 'PDF Tool', title: 'PDF processing failed', message, kind: 'error', target: { appId: 'pdf-tool' } });
      }
    } finally {
      if (request === jobId.current) setBusy(null);
    }
  }

  const mergeHasForms = inputs.some((item) => item.hasForm);
  const canRun =
    (tool === 'merge' && inputs.length > 1) ||
    (tool === 'split' && Boolean(splitRange.trim())) ||
    (tool === 'fill' && (Object.keys(formEdits).length > 0 || marks.some((item) => item.text.trim()))) ||
    (tool === 'watermark' && (watermarkType === 'logo' ? Boolean(watermarkLogo) : Boolean(watermarkText.trim()))) ||
    tool === 'compress';

  const actionLabel = {
    view: '', fill: 'Export filled PDF', merge: 'Merge PDFs', split: 'Split PDF',
    watermark: 'Apply watermark', compress: 'Compress PDF',
  }[tool];

  return (
    <div
      className={'pdf-tool' + (isDropTarget ? ' pdf-drop-active' : '')}
      onDragEnter={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDropTarget(true);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDropTarget(false);
      }}
      onDrop={handleDrop}
    >
      <input hidden ref={picker} type="file" accept="application/pdf,.pdf" multiple onChange={(event) => {
        void openFiles(Array.from(event.currentTarget.files ?? []));
        event.currentTarget.value = '';
      }} />
      <input hidden ref={logoPicker} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        if (file) { clearResult(); setWatermarkLogo(file); }
        event.currentTarget.value = '';
      }} />
      <div className="pdf-toolbar">
        <Button
          className="pdf-open"
          appearance="subtle"
          icon={tool === 'merge' ? <DocumentAddRegular /> : <FolderOpenRegular />}
          onClick={() => picker.current?.click()}
        >{tool === 'merge' ? 'Add PDFs' : 'Open PDF'}</Button>
        <TabList size="small" selectedValue={tool} onTabSelect={(_, data) => changeTool(data.value as Tool)}>
          {tools.map(([value, label]) => <Tab key={value} value={value}>{label}</Tab>)}
        </TabList>
      </div>

      {busy === 'open' && <div className="pdf-banner"><Spinner size="tiny" label="Opening PDF…" /></div>}
      {error && <div className="pdf-banner pdf-error" role="alert">{error}</div>}
      {notice && <div className="pdf-banner" role="status">{notice}</div>}
      {!input || !preview ? (
        <div className="pdf-empty">
          <div className="pdf-dropzone">
            <img src="/assets/icons/pdf-tool.svg" alt="" draggable={false} />
            <h2>{tool === 'merge' ? 'Add PDFs to merge' : 'Drop a PDF here'}</h2>
            <p>Files stay on this device.</p>
            <Button appearance="primary" icon={<FolderOpenRegular />} onClick={() => picker.current?.click()}>
              {tool === 'merge' ? 'Choose PDF files' : 'Choose a PDF'}
            </Button>
          </div>
        </div>
      ) : (
        <div className={'pdf-workspace' + (tool === 'view' ? ' pdf-view-only' : '')}>
          <PdfPreview
            key={input.id + ':' + (outputIndex ?? 'input') + ':' + (output?.name ?? '')}
            bytes={preview.bytes}
            name={preview.name}
            pageNumber={page}
            onPage={setPage}
            marks={tool === 'fill' && !output ? marks : undefined}
            onPlace={tool === 'fill' && placing && !output ? placeText : undefined}
          />
          {tool !== 'view' && (
            <aside className="pdf-panel" aria-label={toolName + ' settings'}>
              <div className="pdf-panel-body">
                <h2>{toolName}</h2>
                <fieldset disabled={busy !== null} className="pdf-tool-options" aria-label={toolName + ' options'}>
                  {tool === 'merge' && (
                    <>
                      <p className="pdf-note">Pages follow the file order below.</p>
                      <ol className="pdf-file-list">
                        {inputs.map((item, index) => (
                          <li key={item.id} className={item.id === activeId ? 'pdf-current-file' : ''}>
                            <button type="button" className="pdf-file-select" aria-pressed={item.id === activeId && !output} title={item.name} onClick={() => {
                              if (item.id === activeId) showOutput(null);
                              else activate(item.id);
                            }}>
                              <DocumentRegular />
                              <span>{item.name}<small>{item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}</small></span>
                            </button>
                            <div className="pdf-file-actions">
                              <Button size="small" appearance="subtle" icon={<ArrowUpRegular />} aria-label={'Move up ' + item.name} disabled={index === 0} onClick={() => moveFile(index, -1)} />
                              <Button size="small" appearance="subtle" icon={<ArrowDownRegular />} aria-label={'Move down ' + item.name} disabled={index === inputs.length - 1} onClick={() => moveFile(index, 1)} />
                              <Button size="small" appearance="subtle" icon={<DeleteRegular />} aria-label={'Remove ' + item.name} onClick={() => removeFile(item.id)} />
                            </div>
                          </li>
                        ))}
                      </ol>
                      {mergeHasForms && <p className="pdf-note">Form values in the merged PDF will become fixed page content.</p>}
                      {inputs.length < 2 && <p className="pdf-note">Add another PDF to merge.</p>}
                    </>
                  )}
                  {tool === 'split' && (
                    <>
                      <label className="pdf-field"><span>Page ranges</span><Input placeholder="1–3, 6" value={splitRange} onChange={(_, data) => { clearResult(); setSplitRange(data.value); }} /></label>
                      <p className="pdf-note">Use page numbers from 1 to {input.pageCount}.</p>
                      <Checkbox label="Create one PDF per range" checked={splitSeparate} onChange={(_, data) => { clearResult(); setSplitSeparate(data.checked === true); }} />
                      {input.hasForm && <p className="pdf-note">Form values in the split PDFs will become fixed page content.</p>}
                    </>
                  )}
                  {tool === 'fill' && (
                    <>
                      {input.fields.map((field) => <EditField
                        key={field.name}
                        field={field}
                        value={Object.hasOwn(formEdits, field.name) ? formEdits[field.name] : undefined}
                        onChange={(value) => {
                          clearResult();
                          setFormEdits((old) => ({ ...old, [field.name]: value }));
                        }}
                      />)}
                      <div className="pdf-text-settings">
                        <Button appearance={placing ? 'primary' : 'secondary'} icon={<TextAddRegular />} onClick={() => {
                          if (output) showOutput(null);
                          setPlacing(!placing);
                        }}>{placing ? 'Cancel placement' : 'Place text'}</Button>
                        <p className="pdf-note">{placing ? 'Click the page where you want the text.' : 'Place text anywhere on a PDF or scan.'}</p>
                        {marks.length > 0 && (
                          <div className="pdf-marker-list" aria-label="Placed text">
                            {marks.map((item) => (
                              <Button key={item.id} size="small" appearance={item.id === activeMarkId ? 'secondary' : 'subtle'} onClick={() => {
                                setOutputIndex(null);
                                setPage(item.page);
                                setActiveMarkId(item.id);
                              }}>{item.text || 'Empty text'} · p. {item.page}</Button>
                            ))}
                          </div>
                        )}
                        {mark && (
                          <>
                            <label className="pdf-field"><span>Text on page {mark.page}</span><Input ref={markEditor} value={mark.text} onChange={(_, data) => editMark(mark.id, { text: data.value })} /></label>
                            <div className="pdf-mark-settings">
                              <label className="pdf-field"><span>Text size (pt)</span><select aria-label="Text size (pt)" value={mark.size} onChange={(event) => editMark(mark.id, { size: Number(event.currentTarget.value) })}>
                                {[8, 10, 12, 14, 18, 24, 32, 48].map((size) => <option key={size}>{size}</option>)}
                              </select></label>
                              <Button appearance="subtle" icon={<DeleteRegular />} aria-label="Remove placed text" onClick={() => {
                                clearResult();
                                const remaining = marks.filter((item) => item.id !== mark.id);
                                setMarks(remaining);
                                setActiveMarkId(remaining.at(-1)?.id ?? '');
                              }} />
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {tool === 'watermark' && (
                    <>
                      <label className="pdf-field"><span>Watermark type</span><select aria-label="Watermark type" value={watermarkType} onChange={(event) => {
                        clearResult();
                        setWatermarkType(event.currentTarget.value === 'logo' ? 'logo' : 'text');
                      }}><option value="text">Text</option><option value="logo">Logo</option></select></label>
                      {watermarkType === 'text'
                        ? <label className="pdf-field"><span>Watermark text</span><Input value={watermarkText} onChange={(_, data) => { clearResult(); setWatermarkText(data.value); }} /></label>
                        : <><Button appearance="secondary" icon={<ImageRegular />} onClick={() => logoPicker.current?.click()}>Choose PNG or JPEG</Button>{watermarkLogo && <p className="pdf-note pdf-wrap">{watermarkLogo.name}</p>}</>}
                      <label className="pdf-field"><span>Position</span><select aria-label="Position" value={watermarkPosition} onChange={(event) => {
                        clearResult();
                        setWatermarkPosition(event.currentTarget.value as WatermarkOptions['position']);
                      }}>
                        <option value="center">Center</option><option value="top-left">Top left</option><option value="top-right">Top right</option>
                        <option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option>
                      </select></label>
                      <label className="pdf-field"><span>Opacity · {opacity}%</span><input type="range" min={5} max={100} value={opacity} onChange={(event) => {
                        clearResult();
                        setOpacity(Number(event.currentTarget.value));
                      }} /></label>
                      <label className="pdf-field"><span>Pages</span><Input placeholder="All pages" value={watermarkRange} onChange={(_, data) => { clearResult(); setWatermarkRange(data.value); }} /></label>
                      <p className="pdf-note">Leave empty for all pages, or enter a range such as 1–3.</p>
                    </>
                  )}
                  {tool === 'compress' && (
                    <fieldset className="pdf-radio pdf-compress-options">
                      <legend>Compression mode</legend>
                      <label><input type="radio" name="pdf-compress-mode" checked={!strong} onChange={() => { clearResult(); setStrong(false); }} />
                        <span>Keep quality<small>Optimize the file while preserving image quality.</small></span></label>
                      <label><input type="radio" name="pdf-compress-mode" checked={strong} onChange={() => { clearResult(); setStrong(true); }} />
                        <span>Strong compression<small>Reduce the size of large images. Scans may appear softer.</small></span></label>
                    </fieldset>
                  )}
                </fieldset>

                {tool === 'compress' && (
                  <dl className="pdf-sizes">
                    <div><dt>Original</dt><dd>{formatBytes(input.bytes.byteLength)}</dd></div>
                    <div><dt>Compressed</dt><dd>{outputs[0] ? formatBytes(outputs[0].bytes.byteLength) : '—'}</dd></div>
                  </dl>
                )}
              </div>
              <div className="pdf-panel-footer">
                {outputs.length > 0 && (
                  <div className="pdf-results">
                    <div className="pdf-result-title"><span>{outputs.length === 1 ? 'Result' : outputs.length + ' results'}</span>
                      <Button appearance="subtle" size="small" disabled={!output} onClick={() => showOutput(null)}>View original</Button>
                    </div>
                    {outputs.map((result, index) => (
                      <div className="pdf-result" key={result.name}>
                        <button className="pdf-result-name" type="button" aria-pressed={outputIndex === index} title={result.name} onClick={() => showOutput(index)}>{result.name}</button>
                        <Button appearance="subtle" size="small" icon={<ArrowDownloadRegular />} aria-label={'Download ' + result.name} onClick={() => downloadPdf(result)} />
                      </div>
                    ))}
                  </div>
                )}
                {outputs.length ? (
                  <Button appearance="primary" icon={<ArrowDownloadRegular />} onClick={() => downloadPdf(output ?? outputs[0])}>Download PDF</Button>
                ) : (
                  <Button appearance="primary" disabled={!canRun || busy !== null} onClick={() => void runTool()}>
                    {busy === 'run' ? <Spinner size="tiny" label="Processing…" /> : actionLabel}
                  </Button>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
