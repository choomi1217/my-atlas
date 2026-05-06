import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SegmentTreeView } from '../SegmentTreeView';
import { Segment } from '@/types/features';
import * as featuresApi from '@/api/features';

vi.mock('@/api/features', () => ({
  segmentApi: {
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    reparent: vi.fn(),
    reorder: vi.fn(),
  },
  featureImageApi: {},
  testCaseImageApi: {},
}));

const baseProps = {
  testCases: [],
  selectedPath: [] as number[],
  onSelectPath: vi.fn(),
  productId: 1,
  onSegmentCreated: vi.fn(),
  onSegmentDeleted: vi.fn(),
  onSegmentsUpdated: vi.fn(),
};

describe('SegmentTreeView 정렬 + Reorder (PR-C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('childrenMap 이 orderIndex 기준으로 형제 노드를 정렬한다', () => {
    // 입력 순서를 일부러 뒤섞어도 orderIndex 순서로 노출되어야 함
    const segments: Segment[] = [
      { id: 2, name: 'B', productId: 1, parentId: null, orderIndex: 1 },
      { id: 1, name: 'A', productId: 1, parentId: null, orderIndex: 0 },
      { id: 3, name: 'C', productId: 1, parentId: null, orderIndex: 2 },
    ];
    render(<SegmentTreeView {...baseProps} segments={segments} />);

    const moveUp1 = screen.queryByTestId('segment-move-up-1');
    const moveUp2 = screen.queryByTestId('segment-move-up-2');
    const moveUp3 = screen.queryByTestId('segment-move-up-3');
    // 모든 root 가 노출되었는지 확인
    expect(moveUp1).not.toBeNull();
    expect(moveUp2).not.toBeNull();
    expect(moveUp3).not.toBeNull();

    // A(orderIndex 0)는 첫 번째 → up 버튼 비활성화
    expect(moveUp1).toBeDisabled();
    // B(orderIndex 1)는 중간 → 활성화
    expect(moveUp2).not.toBeDisabled();
    // C(orderIndex 2)는 마지막 → up 활성화, down 비활성화
    expect(moveUp3).not.toBeDisabled();
    expect(screen.getByTestId('segment-move-down-3')).toBeDisabled();
  });

  it('▼ 버튼 클릭 시 segmentApi.reorder 가 새 순서로 호출된다', async () => {
    const segments: Segment[] = [
      { id: 1, name: 'A', productId: 1, parentId: null, orderIndex: 0 },
      { id: 2, name: 'B', productId: 1, parentId: null, orderIndex: 1 },
      { id: 3, name: 'C', productId: 1, parentId: null, orderIndex: 2 },
    ];
    const reorderMock = vi.mocked(featuresApi.segmentApi.reorder);
    reorderMock.mockResolvedValue(undefined);

    render(<SegmentTreeView {...baseProps} segments={segments} />);

    // A 아래로 이동 → A 와 B 가 swap → 새 순서: B, A, C
    fireEvent.click(screen.getByTestId('segment-move-down-1'));

    await waitFor(() => {
      expect(reorderMock).toHaveBeenCalledWith(1, null, [2, 1, 3]);
    });
  });

  it('▲ 버튼 클릭 시 위로 이동된 새 순서로 reorder API 호출', async () => {
    const segments: Segment[] = [
      { id: 1, name: 'A', productId: 1, parentId: null, orderIndex: 0 },
      { id: 2, name: 'B', productId: 1, parentId: null, orderIndex: 1 },
    ];
    const reorderMock = vi.mocked(featuresApi.segmentApi.reorder);
    reorderMock.mockResolvedValue(undefined);

    render(<SegmentTreeView {...baseProps} segments={segments} />);

    // B 위로 이동 → 새 순서: B, A
    fireEvent.click(screen.getByTestId('segment-move-up-2'));

    await waitFor(() => {
      expect(reorderMock).toHaveBeenCalledWith(1, null, [2, 1]);
    });
  });

  it('+ Root Path 버튼이 노출되어 다중 Root 추가 진입점을 제공한다', () => {
    const segments: Segment[] = [
      { id: 1, name: 'My Senior', productId: 1, parentId: null, orderIndex: 0 },
    ];
    render(<SegmentTreeView {...baseProps} segments={segments} />);

    expect(screen.getByTestId('segment-add-root')).toBeInTheDocument();
    expect(screen.getByTestId('segment-add-root')).toHaveTextContent('+ Root Path');
  });
});
