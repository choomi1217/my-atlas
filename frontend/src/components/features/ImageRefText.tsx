import { useState } from 'react';
import { TestCaseImage } from '@/types/features';

/**
 * Renders text with `image #N` patterns as hoverable links that show image previews.
 * Used in TC card expanded details (TestCasePage, TestRunDetailPage, VersionPhaseDetailPage).
 */
export default function ImageRefText({
  text,
  images,
}: {
  text: string;
  images?: TestCaseImage[];
}) {
  const [hoveredImage, setHoveredImage] = useState<{
    img: TestCaseImage;
    x: number;
    y: number;
  } | null>(null);

  if (!text) return null;
  if (!images || images.length === 0) return <>{text}</>;

  // Split text by `image #N` pattern, keeping the matched parts
  const parts = text.split(/(image #\d+)/g);

  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^image #(\d+)$/);
        if (!match) return <span key={i}>{part}</span>;

        const orderIndex = parseInt(match[1], 10);
        const img = images.find((im) => im.orderIndex === orderIndex);

        if (!img) {
          return (
            <span key={i} className="font-mono text-gray-400">
              {part}
            </span>
          );
        }

        return (
          <span
            key={i}
            className="font-mono text-indigo-600 bg-indigo-50 px-1 rounded cursor-pointer hover:bg-indigo-100 transition-colors"
            onMouseEnter={(e) =>
              setHoveredImage({ img, x: e.clientX, y: e.clientY })
            }
            onMouseMove={(e) =>
              setHoveredImage((prev) =>
                prev ? { ...prev, x: e.clientX, y: e.clientY } : null
              )
            }
            onMouseLeave={() => setHoveredImage(null)}
          >
            {part}
          </span>
        );
      })}

      {hoveredImage && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: hoveredImage.x + 16,
            top: hoveredImage.y - 100,
          }}
        >
          <img
            src={hoveredImage.img.url}
            alt={hoveredImage.img.originalName}
            className="max-w-sm max-h-64 rounded shadow-lg border bg-white"
          />
          <div className="text-xs text-gray-500 mt-1 bg-white px-2 py-1 rounded shadow">
            {hoveredImage.img.originalName}
          </div>
        </div>
      )}
    </>
  );
}
