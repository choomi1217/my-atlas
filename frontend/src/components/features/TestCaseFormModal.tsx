import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Segment,
  TestCase,
  TestCaseImage,
  TestStep,
  TestCasePriority,
  TestCaseType,
  TestCaseStatus,
} from '@/types/features';
import { featureImageApi, testCaseImageApi } from '@/api/features';
import SegmentTreePicker from './SegmentTreePicker';

interface TestCaseFormData {
  title: string;
  description: string;
  promptText: string;
  priority: TestCasePriority;
  testType: TestCaseType;
  status: TestCaseStatus;
  preconditions: string;
  steps: TestStep[];
  expectedResults: string[];
}

interface TestCaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TestCaseFormData) => Promise<TestCase | void>;
  initialData?: TestCase | null;
  pathDisplay: string;
  /**
   * When provided, the modal renders an inline Segment tree picker and lets the user
   * change the TC's path. The parent is responsible for applying the path change
   * (e.g. via testCaseApi.updatePath) when the form is submitted or when onPathChange fires.
   */
  pathEdit?: {
    segments: Segment[];
    selectedPath: number[];
    onChange: (nextPath: number[]) => void;
  };
}

const emptyForm: TestCaseFormData = {
  title: '',
  description: '',
  promptText: '',
  priority: TestCasePriority.MEDIUM,
  testType: TestCaseType.FUNCTIONAL,
  status: TestCaseStatus.ACTIVE,
  preconditions: '',
  steps: [{ order: 1, action: '', expected: '' }],
  expectedResults: [''],
};

/** Dropdown button to insert `image #N` text into an input field */
function ImageInsertButton({
  images,
  onInsert,
}: {
  images: TestCaseImage[];
  onInsert: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (images.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-1.5 py-1 text-gray-400 hover:text-indigo-600 text-sm flex-shrink-0"
        title="Insert image reference"
      >
        📎
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-50 min-w-[200px]">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                onInsert(`image #${img.orderIndex}`);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2"
            >
              <span className="font-mono text-indigo-600 flex-shrink-0">
                image #{img.orderIndex}
              </span>
              <span className="text-gray-400 truncate text-xs">
                {img.originalName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render hoverable badges for `image #N` references found in text */
function ImageRefPreview({
  text,
  images,
  onHover,
  onLeave,
}: {
  text: string;
  images: TestCaseImage[];
  onHover: (img: TestCaseImage, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  if (!text || images.length === 0) return null;
  const refs = text.match(/image #(\d+)/g);
  if (!refs) return null;

  const matched = refs
    .map((ref) => {
      const idx = parseInt(ref.replace('image #', ''), 10);
      return images.find((img) => img.orderIndex === idx);
    })
    .filter(Boolean) as TestCaseImage[];

  if (matched.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {matched.map((img) => (
        <span
          key={img.id}
          className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-100 transition-colors"
          onMouseEnter={(e) => onHover(img, e)}
          onMouseLeave={onLeave}
        >
          image #{img.orderIndex}
        </span>
      ))}
    </div>
  );
}

export default function TestCaseFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  pathDisplay,
  pathEdit,
}: TestCaseFormModalProps) {
  const [form, setForm] = useState<TestCaseFormData>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<TestCaseImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<TestCaseImage | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title,
        description: initialData.description || '',
        promptText: initialData.promptText || '',
        priority: initialData.priority,
        testType: initialData.testType,
        status: initialData.status,
        preconditions: initialData.preconditions || '',
        steps:
          initialData.steps && initialData.steps.length > 0
            ? initialData.steps
            : [{ order: 1, action: '', expected: '' }],
        expectedResults:
          initialData.expectedResults && initialData.expectedResults.length > 0
            ? initialData.expectedResults
            : [''],
      });
      // BUG-2 fix: always fetch images from API (not stale initialData.images)
      if (initialData.id) {
        testCaseImageApi
          .getByTestCaseId(initialData.id)
          .then(setImages)
          .catch(() => setImages([]));
      } else {
        setImages([]);
      }
    } else {
      setForm(emptyForm);
      setImages([]);
    }
  }, [initialData, isOpen]);

  const handleImageUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !initialData?.id) return;
      setUploadingImage(true);
      try {
        for (const file of Array.from(files)) {
          const uploaded = await featureImageApi.upload(file);
          const linked = await testCaseImageApi.addImage(
            initialData.id,
            uploaded.filename,
            uploaded.originalName
          );
          setImages((prev) => [...prev, linked]);
        }
      } finally {
        setUploadingImage(false);
      }
    },
    [initialData?.id]
  );

  const handleRemoveImage = useCallback(
    async (imageId: number) => {
      if (!initialData?.id) return;
      await testCaseImageApi.removeImage(initialData.id, imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    },
    [initialData?.id]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleImageUpload(e.dataTransfer.files);
    },
    [handleImageUpload]
  );

  const handleImageHover = (img: TestCaseImage, e: React.MouseEvent) => {
    setHoveredImage(img);
    setHoverPos({ x: e.clientX, y: e.clientY });
  };

  if (!isOpen) return null;

  const isEdit = !!initialData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await onSubmit(form);
      if (!result) {
        // Edit mode — close modal
        onClose();
      }
      // Create mode — parent sets modalEditData, modal stays open for images
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStep = (
    idx: number,
    field: 'action' | 'expected',
    value: string
  ) => {
    const updated = [...form.steps];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, steps: updated });
  };

  const insertImageRef = (
    idx: number,
    field: 'action' | 'expected',
    text: string
  ) => {
    const current = form.steps[idx][field];
    updateStep(idx, field, current ? `${current} ${text}` : text);
  };

  const updateExpectedResult = (idx: number, value: string) => {
    const updated = [...form.expectedResults];
    updated[idx] = value;
    setForm({ ...form, expectedResults: updated });
  };

  const insertImageRefToExpectedResult = (idx: number, text: string) => {
    const current = form.expectedResults[idx] || '';
    updateExpectedResult(idx, current ? `${current} ${text}` : text);
  };

  const addExpectedResult = () => {
    setForm({ ...form, expectedResults: [...form.expectedResults, ''] });
  };

  const removeExpectedResult = (idx: number) => {
    if (form.expectedResults.length <= 1) return;
    const updated = form.expectedResults.filter((_, i) => i !== idx);
    setForm({ ...form, expectedResults: updated });
  };

  const addStep = () => {
    setForm({
      ...form,
      steps: [
        ...form.steps,
        { order: form.steps.length + 1, action: '', expected: '' },
      ],
    });
  };

  const removeStep = (idx: number) => {
    if (form.steps.length <= 1) return;
    const updated = form.steps
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, order: i + 1 }));
    setForm({ ...form, steps: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800">
              {isEdit ? 'Edit Test Case' : 'Add Test Case'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
            {/* Path — editable when pathEdit is provided, read-only otherwise */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Path
              </label>
              <div className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded border">
                {pathDisplay || 'Path 미지정'}
              </div>
              {pathEdit && (
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-1">
                    Segment을 선택해 Path를 지정하세요. 위의 표시는 저장 후 갱신됩니다.
                  </div>
                  <SegmentTreePicker
                    segments={pathEdit.segments}
                    selectedPath={pathEdit.selectedPath}
                    onChange={pathEdit.onChange}
                  />
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                placeholder="Test case title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Priority / TestType / Status */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value as TestCasePriority,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.values(TestCasePriority).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Type
                </label>
                <select
                  value={form.testType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      testType: e.target.value as TestCaseType,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.values(TestCaseType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as TestCaseStatus,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.values(TestCaseStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preconditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preconditions
              </label>
              <textarea
                value={form.preconditions}
                onChange={(e) =>
                  setForm({ ...form, preconditions: e.target.value })
                }
                placeholder="Preconditions..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Images — visible when TC has an ID (edit mode or after create) */}
            {initialData?.id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Images
                </label>
                <div
                  ref={dropRef}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="bg-gray-50 p-3 rounded border border-dashed border-gray-300 text-center"
                >
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 justify-start">
                      {images.map((img) => (
                        <div
                          key={img.id}
                          className="relative group flex items-center gap-1 bg-white border rounded px-2 py-1"
                          onMouseEnter={(e) => handleImageHover(img, e)}
                          onMouseLeave={() => setHoveredImage(null)}
                        >
                          <span className="text-xs font-mono text-indigo-600">
                            image #{img.orderIndex}
                          </span>
                          <span className="text-xs text-gray-400 truncate max-w-[100px]">
                            {img.originalName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(img.id)}
                            className="text-gray-300 hover:text-red-500 text-xs ml-1"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="cursor-pointer text-sm text-gray-500 hover:text-indigo-600">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files)}
                    />
                    {uploadingImage
                      ? 'Uploading...'
                      : 'Drop images here or click to attach'}
                  </label>
                </div>
              </div>
            )}

            {/* Image hover preview */}
            {hoveredImage && (
              <div
                className="fixed z-[100] pointer-events-none"
                style={{ left: hoverPos.x + 16, top: hoverPos.y - 100 }}
              >
                <img
                  src={hoveredImage.url}
                  alt={hoveredImage.originalName}
                  className="max-w-sm max-h-64 rounded shadow-lg border"
                />
              </div>
            )}

            {/* Steps */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Steps
              </label>
              <div className="bg-gray-50 p-3 rounded border space-y-2">
                {form.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white p-2 rounded border"
                  >
                    <span className="text-xs text-gray-400 mt-2 flex-shrink-0">
                      #{step.order}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={step.action}
                            onChange={(e) =>
                              updateStep(idx, 'action', e.target.value)
                            }
                            placeholder="Action..."
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm
                                       focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                          <ImageInsertButton
                            images={images}
                            onInsert={(text) =>
                              insertImageRef(idx, 'action', text)
                            }
                          />
                        </div>
                        <ImageRefPreview
                          text={step.action}
                          images={images}
                          onHover={handleImageHover}
                          onLeave={() => setHoveredImage(null)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={step.expected}
                            onChange={(e) =>
                              updateStep(idx, 'expected', e.target.value)
                            }
                            placeholder="Expected..."
                            className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm
                                       focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                          <ImageInsertButton
                            images={images}
                            onInsert={(text) =>
                              insertImageRef(idx, 'expected', text)
                            }
                          />
                        </div>
                        <ImageRefPreview
                          text={step.expected}
                          images={images}
                          onHover={handleImageHover}
                          onLeave={() => setHoveredImage(null)}
                        />
                      </div>
                    </div>
                    {form.steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="text-gray-300 hover:text-red-500 text-sm mt-2 flex-shrink-0"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addStep}
                  className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  + Add Step
                </button>
              </div>
            </div>

            {/* Final Expected Results — multiple */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Final Expected Results
              </label>
              <div className="bg-gray-50 p-3 rounded border space-y-2">
                {form.expectedResults.map((expected, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-white p-2 rounded border"
                    data-testid="expected-result-row"
                  >
                    <span className="text-xs text-gray-400 mt-2 flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={expected}
                          onChange={(e) =>
                            updateExpectedResult(idx, e.target.value)
                          }
                          placeholder="Expected result..."
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm
                                     focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        />
                        <ImageInsertButton
                          images={images}
                          onInsert={(text) =>
                            insertImageRefToExpectedResult(idx, text)
                          }
                        />
                      </div>
                      <ImageRefPreview
                        text={expected}
                        images={images}
                        onHover={handleImageHover}
                        onLeave={() => setHoveredImage(null)}
                      />
                    </div>
                    {form.expectedResults.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExpectedResult(idx)}
                        className="text-gray-300 hover:text-red-500 text-sm mt-2 flex-shrink-0"
                        aria-label="Remove expected result"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExpectedResult}
                  className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  + Add Expected Result
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md
                         hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !form.title.trim()}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md
                         hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
