'use client';

export function ExamMobileBar({
  seconds,
  onSubmit,
  submitLabel = 'Nộp bài',
  disabled,
}: {
  seconds: number;
  onSubmit: () => void;
  submitLabel?: string;
  disabled: boolean;
}) {
  return (
    <div className="reference-exam-mobile-bar" aria-label="Thao tác làm bài nhanh">
      <span>
        Còn lại{' '}
        <strong>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </strong>
      </span>
      <button
        type="button"
        className="reference-exam-mobile-map"
        onClick={() => {
          const sidebar = document.getElementById('exam-question-sidebar');
          sidebar?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          sidebar?.focus({ preventScroll: true });
        }}
      >
        Bảng câu hỏi
      </button>
      <button
        type="button"
        className="reference-exam-mobile-submit"
        disabled={disabled}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}
